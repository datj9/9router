import { describe, expect, it } from "vitest";
import { CodexExecutor } from "../../open-sse/executors/codex.js";

describe("CodexExecutor Responses input sanitization", () => {
  it("adds type:message to items with role but no type", () => {
    const executor = new CodexExecutor();
    const requestBody = {
      model: "gpt-5.3-codex",
      input: [{ role: "system", content: "you are helpful" }],
    };

    const output = executor.transformRequest("gpt-5.3-codex", requestBody, true, {});

    expect(output.input[0].type).toBe("message");
    expect(output.input[0].role).toBe("developer");
  });

  it("converts bare-string content to typed array for message items", () => {
    const executor = new CodexExecutor();
    const requestBody = {
      model: "gpt-5.3-codex",
      input: [{ type: "message", role: "user", content: "hello" }],
    };

    const output = executor.transformRequest("gpt-5.3-codex", requestBody, true, {});

    expect(output.input[0].content).toEqual([{ type: "input_text", text: "hello" }]);
  });

  it("converts bare-string content to output_text for assistant messages", () => {
    const executor = new CodexExecutor();
    const requestBody = {
      model: "gpt-5.3-codex",
      input: [{ type: "message", role: "assistant", content: "hi there" }],
    };

    const output = executor.transformRequest("gpt-5.3-codex", requestBody, true, {});

    expect(output.input[0].content).toEqual([{ type: "output_text", text: "hi there" }]);
  });

  it("sanitizes system prompts injected before a Responses message", () => {
    const executor = new CodexExecutor();
    const requestBody = {
      model: "gpt-5.3-codex",
      input: [
        { role: "system", content: "Respond terse." },
        { type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] },
      ],
    };

    const output = executor.transformRequest("gpt-5.3-codex", requestBody, true, {});

    expect(output.input[0]).toEqual({
      type: "message",
      role: "developer",
      content: [{ type: "input_text", text: "Respond terse." }],
    });
  });

  it("leaves well-formed message items unchanged", () => {
    const executor = new CodexExecutor();
    const requestBody = {
      model: "gpt-5.3-codex",
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }],
    };

    const output = executor.transformRequest("gpt-5.3-codex", requestBody, true, {});

    expect(output.input[0]).toEqual({
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "hi" }],
    });
  });

  it("does not alter non-message items", () => {
    const executor = new CodexExecutor();
    const requestBody = {
      model: "gpt-5.3-codex",
      input: [
        { type: "reasoning", summary: [{ type: "summary_text", text: "thinking..." }] },
        { type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] },
      ],
    };

    const output = executor.transformRequest("gpt-5.3-codex", requestBody, true, {});

    expect(output.input[0]).toEqual({
      type: "reasoning",
      summary: [{ type: "summary_text", text: "thinking..." }],
    });
  });
});
