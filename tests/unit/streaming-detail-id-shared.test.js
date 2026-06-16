import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression guard for the "streaming request stuck at 0 tokens" bug.
//
// A streaming request writes a requestDetails row twice:
//   1. handleStreamingResponse — a placeholder row ("[Streaming in progress...]",
//      0 tokens) saved immediately so the request appears in the dashboard.
//   2. onStreamComplete (from buildOnStreamComplete) — the final update with the
//      real content + token usage once the upstream stream finishes.
//
// The repo upserts on `id` (ON CONFLICT(id) DO UPDATE). Previously each save
// generated its OWN random streamDetailId, so the completion update inserted a
// SECOND row instead of updating the placeholder. Anyone opening the placeholder
// row saw 0 input/output tokens and "[Streaming in progress...]" forever.
//
// The contract this test locks in: both saves use the SAME id, so the second
// save updates the first row in place.

const saveRequestDetail = vi.fn(() => Promise.resolve());
const saveRequestUsage = vi.fn(() => Promise.resolve());
const appendRequestLog = vi.fn(() => Promise.resolve());

vi.mock("@/lib/usageDb.js", () => ({
  saveRequestDetail: (...args) => saveRequestDetail(...args),
  saveRequestUsage: (...args) => saveRequestUsage(...args),
  appendRequestLog: (...args) => appendRequestLog(...args),
  trackPendingRequest: vi.fn(),
}));

const { handleStreamingResponse, buildOnStreamComplete } = await import(
  "../../open-sse/handlers/chatCore/streamingHandler.js"
);

function buildContext(streamDetailId) {
  return {
    provider: "anthropic",
    model: "claude-opus-4-8",
    connectionId: "conn-1234",
    apiKey: "sk-test-key",
    requestStartTime: Date.now(),
    body: { messages: [{ role: "user", content: "hi" }], model: "claude-opus-4-8" },
    stream: true,
    finalBody: null,
    translatedBody: null,
    clientRawRequest: { endpoint: "/v1/messages", project: "beli" },
    // Minimal stubs so handleStreamingResponse runs without a real upstream.
    sourceFormat: "claude",
    targetFormat: "claude",
    userAgent: "test",
    onRequestSuccess: null,
    reqLogger: null,
    toolNameMap: null,
    providerResponse: { body: new ReadableStream({ start(controller) { controller.close(); } }) },
    streamController: {
      signal: new AbortController().signal,
      startTime: Date.now(),
      isConnected: () => true,
      handleComplete: () => {},
      handleError: () => {},
      handleDisconnect: () => {},
      abort: () => {},
    },
    streamDetailId,
  };
}

describe("streaming placeholder and completion share one detail id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("placeholder save and completion update use the identical id", () => {
    const { onStreamComplete, streamDetailId } = buildOnStreamComplete(buildContext());
    expect(streamDetailId).toBeTruthy();

    // 1. placeholder row
    handleStreamingResponse({ ...buildContext(streamDetailId), onStreamComplete });

    // 2. completion update — fires when the upstream stream ends
    onStreamComplete(
      { content: "real answer", thinking: null },
      { input_tokens: 100, output_tokens: 50 },
      Date.now()
    );

    expect(saveRequestDetail).toHaveBeenCalledTimes(2);
    const placeholderId = saveRequestDetail.mock.calls[0][0].id;
    const completionId = saveRequestDetail.mock.calls[1][0].id;

    expect(placeholderId).toBe(streamDetailId);
    expect(completionId).toBe(streamDetailId);
    expect(completionId).toBe(placeholderId); // same row → upsert updates, no orphan
  });

  it("completion update carries the real tokens and content (not the 0-token placeholder)", () => {
    const { onStreamComplete } = buildOnStreamComplete(buildContext());
    onStreamComplete(
      { content: "real answer", thinking: null },
      { input_tokens: 100, output_tokens: 50 },
      Date.now()
    );

    const completion = saveRequestDetail.mock.calls[0][0];
    expect(completion.tokens).toMatchObject({ input_tokens: 100, output_tokens: 50 });
    expect(completion.response.content).toBe("real answer");
  });
});
