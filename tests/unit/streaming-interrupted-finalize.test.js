import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression guard for the "streaming request stuck at 0 tokens even after the
// shared-id fix" bug (request 1780316467100-r0lewav58).
//
// The shared-id fix made the placeholder row and the completion update use one
// id. But onStreamComplete only ran inside the TransformStream's flush(), which
// WHATWG streams call ONLY on clean upstream EOF. When a stream ended abnormally
// — client disconnect, stall-timeout abort, or upstream socket error — flush()
// never ran, so the row stayed "[Streaming in progress...]" / 0 tokens forever.
//
// The contract this test locks in: createSSEStream finalizes (calls
// onStreamComplete exactly once) on BOTH clean EOF and abnormal cancel, and the
// cancel path passes an interruptedReason so the row can be marked interrupted.

vi.mock("@/lib/usageDb.js", () => ({
  trackPendingRequest: vi.fn(),
  appendRequestLog: vi.fn(() => Promise.resolve()),
}));

const { createPassthroughStreamWithLogger } = await import("../../open-sse/utils/stream.js");

// Build: source -> passthrough SSE transform, then read it like the proxy does.
function pipeThroughSSE(sourceChunks, { errorAfter = -1, cancelAfter = -1, onStreamComplete }) {
  const encoder = new TextEncoder();
  let index = 0;
  const source = new ReadableStream({
    pull(controller) {
      if (errorAfter >= 0 && index === errorAfter) {
        controller.error(new Error("The operation was aborted"));
        return;
      }
      if (index >= sourceChunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(sourceChunks[index++]));
    },
  });

  const transform = createPassthroughStreamWithLogger(
    "claude", null, "claude-opus-4-8", "conn-1234",
    { messages: [{ role: "user", content: "hi" }] },
    onStreamComplete, "sk-test"
  );

  const readable = source.pipeThrough(transform);
  const reader = readable.getReader();

  return (async () => {
    let reads = 0;
    try {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
        reads++;
        if (cancelAfter >= 0 && reads >= cancelAfter) {
          await reader.cancel("client-disconnect");
          break;
        }
      }
    } catch {
      // upstream error path — swallow, the transform's cancel() handles finalize
    }
    // let microtasks/cancel hooks settle
    await new Promise((resolve) => setTimeout(resolve, 20));
  })();
}

describe("streaming finalizes the detail row on every termination path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clean EOF: onStreamComplete fires once, not interrupted", async () => {
    const onStreamComplete = vi.fn();
    await pipeThroughSSE(
      [
        'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
        "data: [DONE]\n\n",
      ],
      { onStreamComplete }
    );

    expect(onStreamComplete).toHaveBeenCalledTimes(1);
    const interruptedReason = onStreamComplete.mock.calls[0][3];
    expect(interruptedReason).toBeFalsy();
  });

  it("client disconnect mid-stream: onStreamComplete fires once WITH an interrupted reason", async () => {
    const onStreamComplete = vi.fn();
    await pipeThroughSSE(
      [
        'data: {"choices":[{"delta":{"content":"partial answer"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" more"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" and more"}}]}\n\n',
      ],
      { onStreamComplete, cancelAfter: 1 }
    );

    expect(onStreamComplete).toHaveBeenCalledTimes(1);
    const interruptedReason = onStreamComplete.mock.calls[0][3];
    expect(interruptedReason).toBe("client-disconnect");
  });

  it("upstream error mid-stream: onStreamComplete fires once WITH an interrupted reason", async () => {
    const onStreamComplete = vi.fn();
    await pipeThroughSSE(
      ['data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'],
      { onStreamComplete, errorAfter: 1 }
    );

    expect(onStreamComplete).toHaveBeenCalledTimes(1);
    const interruptedReason = onStreamComplete.mock.calls[0][3];
    expect(String(interruptedReason)).toMatch(/aborted/i);
  });
});
