import { describe, expect, it } from "vitest";

const { createJsonKeepaliveResponse } = await import("../../open-sse/utils/jsonKeepalive.js");

async function readText(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value));
  }
  return chunks.join("");
}

describe("JSON keepalive", () => {
  it("preserves immediate response status before keepalive starts", async () => {
    const result = await createJsonKeepaliveResponse(Promise.resolve({
      success: false,
      response: new Response(JSON.stringify({ error: { message: "bad" } }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      })
    }), { intervalMs: 50 });

    expect(result.response.status).toBe(502);
    expect(await result.response.json()).toEqual({ error: { message: "bad" } });
  });

  it("emits valid leading whitespace before final JSON", async () => {
    const resultPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          response: new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json" }
          })
        });
      }, 30);
    });

    const { response } = await createJsonKeepaliveResponse(resultPromise, { intervalMs: 5 });
    const text = await readText(response);

    expect(text.startsWith(" \n")).toBe(true);
    expect(JSON.parse(text)).toEqual({ ok: true });
  });
});
