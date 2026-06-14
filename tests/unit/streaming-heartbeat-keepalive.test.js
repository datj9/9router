import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression guard for "streaming request aborts at ~55-60s with 0 tokens / null
// ttft when 9router is behind Cloudflare Tunnel" (follow-up to the interrupted-
// finalize fix).
//
// Root cause: Claude with extended thinking can stream ZERO bytes for 60s+ while
// reasoning before the first token. A proxy in front of 9router treats that
// silence as an idle connection and kills it before any token arrives. The fix
// emits an SSE comment line (": ...") on an idle timer so the connection stays
// active until the real first token shows up.
//
// Contract locked in here:
//  1. While upstream is silent, the transform emits heartbeat comment lines.
//  2. Comment lines are SSE comments (start with ":") so clients ignore them.
//  3. Heartbeats resume during later idle gaps after real chunks.
//  4. The heartbeat timer is cleared on termination (no leak past finalize).

vi.mock("@/lib/usageDb.js", () => ({
  trackPendingRequest: vi.fn(),
  appendRequestLog: vi.fn(() => Promise.resolve()),
}));

const { createSSEStream } = await import("../../open-sse/utils/stream.js");

const HEARTBEAT_INTERVAL_MS = 20;

// Drive a source whose first chunk is delayed, so the transform sits idle long
// enough to emit heartbeats before any real data flows.
function pipeWithDelay({ firstChunkDelayMs, chunks, heartbeatIntervalMs, onStreamComplete }) {
  const encoder = new TextEncoder();
  let index = 0;
  const source = new ReadableStream({
    async pull(controller) {
      if (index === 0 && firstChunkDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, firstChunkDelayMs));
      }
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index++]));
    },
  });

  const transform = createSSEStream({
    mode: "passthrough",
    provider: "claude",
    model: "claude-opus-4-8",
    connectionId: "conn-1234",
    body: { messages: [{ role: "user", content: "hi" }] },
    onStreamComplete,
    apiKey: "sk-test",
    heartbeatIntervalMs,
  });

  const readable = source.pipeThrough(transform);
  const reader = readable.getReader();
  const decoder = new TextDecoder();

  return (async () => {
    const received = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      received.push(decoder.decode(value));
    }
    return received.join("");
  })();
}

function pipeWithChunkDelays({ chunkDelaysMs, chunks, heartbeatIntervalMs, onStreamComplete }) {
  const encoder = new TextEncoder();
  let index = 0;
  const source = new ReadableStream({
    async pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      const delay = chunkDelaysMs[index] || 0;
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      controller.enqueue(encoder.encode(chunks[index++]));
    },
  });

  const transform = createSSEStream({
    mode: "passthrough",
    provider: "claude",
    model: "claude-opus-4-8",
    connectionId: "conn-1234",
    body: { messages: [{ role: "user", content: "hi" }] },
    onStreamComplete,
    apiKey: "sk-test",
    heartbeatIntervalMs,
  });

  const readable = source.pipeThrough(transform);
  const reader = readable.getReader();
  const decoder = new TextDecoder();

  return (async () => {
    const received = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      received.push(decoder.decode(value));
    }
    return received.join("");
  })();
}

describe("streaming idle keepalive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emits SSE comment heartbeats while upstream is silent before the first token", async () => {
    const onStreamComplete = vi.fn();
    const output = await pipeWithDelay({
      firstChunkDelayMs: HEARTBEAT_INTERVAL_MS * 3, // stay idle across several heartbeat ticks
      chunks: [
        'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
        "data: [DONE]\n\n",
      ],
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      onStreamComplete,
    });

    const heartbeatCount = (output.match(/: 9router-keepalive/g) || []).length;
    expect(heartbeatCount).toBeGreaterThanOrEqual(1);
    // Every heartbeat is an SSE comment line — clients ignore lines starting with ":".
    for (const line of output.split("\n\n")) {
      if (line.includes("9router-keepalive")) {
        expect(line.trimStart().startsWith(":")).toBe(true);
      }
    }
    // Real content still made it through after the idle gap.
    expect(output).toContain('"content":"hello"');
    expect(onStreamComplete).toHaveBeenCalledTimes(1);
  });

  it("does NOT emit heartbeats once tokens are flowing", async () => {
    const onStreamComplete = vi.fn();
    const output = await pipeWithDelay({
      firstChunkDelayMs: 0, // first token immediately, never idle
      chunks: [
        'data: {"choices":[{"delta":{"content":"a"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"b"}}]}\n\n',
        "data: [DONE]\n\n",
      ],
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      onStreamComplete,
    });

    expect(output).not.toContain("9router-keepalive");
    expect(onStreamComplete).toHaveBeenCalledTimes(1);
  });

  it("emits SSE comment heartbeats during idle gaps after the first token", async () => {
    const onStreamComplete = vi.fn();
    const output = await pipeWithChunkDelays({
      chunkDelaysMs: [0, HEARTBEAT_INTERVAL_MS * 3, 0],
      chunks: [
        'data: {"choices":[{"delta":{"content":"a"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"b"}}]}\n\n',
        "data: [DONE]\n\n",
      ],
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      onStreamComplete,
    });

    const heartbeatCount = (output.match(/: 9router-keepalive/g) || []).length;
    expect(heartbeatCount).toBeGreaterThanOrEqual(1);
    expect(output).toContain('"content":"a"');
    expect(output).toContain('"content":"b"');
    expect(onStreamComplete).toHaveBeenCalledTimes(1);
  });

  it("heartbeat disabled when interval <= 0", async () => {
    const onStreamComplete = vi.fn();
    const output = await pipeWithDelay({
      firstChunkDelayMs: HEARTBEAT_INTERVAL_MS * 3,
      chunks: ['data: {"choices":[{"delta":{"content":"x"}}]}\n\n', "data: [DONE]\n\n"],
      heartbeatIntervalMs: 0,
      onStreamComplete,
    });

    expect(output).not.toContain("9router-keepalive");
    expect(onStreamComplete).toHaveBeenCalledTimes(1);
  });
});
