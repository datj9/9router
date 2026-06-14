import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression guard for the streaming usage double-count bug: a streaming
// request used to persist usageHistory twice — once via logUsage (no project
// tag -> "Untagged") and once via saveUsageStats (with project tag) — which
// split each request across the real project and "Untagged".
//
// The contract this test locks in:
//   - logUsage writes ONLY the recent-requests log (appendRequestLog), never
//     usageHistory (saveRequestUsage).
//   - saveUsageStats is the single usageHistory writer for streaming, carries
//     the project tag, and preserves cache/reasoning token detail.

const saveRequestUsage = vi.fn(() => Promise.resolve());
const appendRequestLog = vi.fn(() => Promise.resolve());

vi.mock("@/lib/usageDb.js", () => ({
  saveRequestUsage: (...args) => saveRequestUsage(...args),
  appendRequestLog: (...args) => appendRequestLog(...args),
  saveRequestDetail: vi.fn(() => Promise.resolve()),
}));

import { logUsage } from "../../open-sse/utils/usageTracking.js";
import { saveUsageStats } from "../../open-sse/handlers/chatCore/requestDetail.js";

describe("streaming usage is not double-counted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logUsage records the request log but never writes usageHistory", () => {
    logUsage(
      "anthropic",
      { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 20 },
      "claude-opus-4-8",
      "conn-1234",
      "sk-test-key"
    );

    expect(saveRequestUsage).not.toHaveBeenCalled();
    expect(appendRequestLog).toHaveBeenCalledTimes(1);
  });

  it("saveUsageStats is the single usageHistory writer and carries the project tag", () => {
    saveUsageStats({
      provider: "anthropic",
      model: "claude-opus-4-8",
      tokens: { input_tokens: 100, output_tokens: 50 },
      connectionId: "conn-1234",
      apiKey: "sk-test-key",
      endpoint: "/v1/messages",
      project: "beli",
    });

    expect(saveRequestUsage).toHaveBeenCalledTimes(1);
    expect(saveRequestUsage).toHaveBeenCalledWith(
      expect.objectContaining({ project: "beli", endpoint: "/v1/messages" })
    );
  });

  it("saveUsageStats preserves cache and reasoning token detail", () => {
    saveUsageStats({
      provider: "anthropic",
      model: "claude-opus-4-8",
      tokens: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 20,
        cache_creation_input_tokens: 10,
        reasoning_tokens: 5,
      },
      connectionId: "conn-1234",
      project: "beli",
    });

    expect(saveRequestUsage).toHaveBeenCalledTimes(1);
    const persisted = saveRequestUsage.mock.calls[0][0];
    expect(persisted.tokens).toMatchObject({
      prompt_tokens: 100,
      completion_tokens: 50,
      cache_read_input_tokens: 20,
      cache_creation_input_tokens: 10,
      reasoning_tokens: 5,
    });
  });

  it("saveUsageStats skips persistence when there are no tokens", () => {
    saveUsageStats({
      provider: "anthropic",
      model: "claude-opus-4-8",
      tokens: { input_tokens: 0, output_tokens: 0 },
      project: "beli",
    });

    expect(saveRequestUsage).not.toHaveBeenCalled();
  });
});
