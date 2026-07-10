import { describe, expect, it } from "vitest";
import { injectSystemPrompt } from "../../open-sse/rtk/systemInject.js";
import { FORMATS } from "../../open-sse/translator/formats.js";

const SEP = "\n\n";

describe("injectSystemPrompt — OpenAI Responses format", () => {
  it("appends to body.instructions when present (no input mutation)", () => {
    const body = {
      instructions: "be brief",
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }],
    };
    injectSystemPrompt(body, FORMATS.OPENAI_RESPONSES, "extra rule");

    expect(body.instructions).toBe(`be brief${SEP}extra rule`);
    expect(body.input).toHaveLength(1);
  });

  it("sets body.instructions when empty string", () => {
    const body = {
      instructions: "",
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }],
    };
    injectSystemPrompt(body, FORMATS.OPENAI_RESPONSES, "extra rule");

    expect(body.instructions).toBe("extra rule");
    expect(body.input).toHaveLength(1);
  });

  it("sets instructions without prepending a Responses input item", () => {
    const body = {
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }],
    };
    injectSystemPrompt(body, FORMATS.OPENAI_RESPONSES, "be terse");

    expect(body.instructions).toBe("be terse");
    expect(body.input).toEqual([
      { type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] },
    ]);
  });

  it("combines multiple injected prompts in instructions", () => {
    const body = {
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] }],
    };
    injectSystemPrompt(body, FORMATS.OPENAI_RESPONSES, "caveman prompt");
    injectSystemPrompt(body, FORMATS.OPENAI_RESPONSES, "ponytail prompt");

    expect(body.instructions).toBe(`caveman prompt${SEP}ponytail prompt`);
    expect(body.input).toHaveLength(1);
  });
});

describe("injectSystemPrompt — OpenAI Chat Completions format (unchanged behavior)", () => {
  it("unshifts {role,content:string} for Chat Completions", () => {
    const body = {
      messages: [{ role: "user", content: "hi" }],
    };
    injectSystemPrompt(body, FORMATS.OPENAI, "be terse");

    expect(body.messages[0]).toEqual({ role: "system", content: "be terse" });
  });

  it("appends string content for Chat Completions system message", () => {
    const body = {
      messages: [{ role: "system", content: "base" }],
    };
    injectSystemPrompt(body, FORMATS.OPENAI, "extra");

    expect(body.messages[0].content).toBe(`base${SEP}extra`);
    expect(body.messages[0].type).toBeUndefined();
  });
});
