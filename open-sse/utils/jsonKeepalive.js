import { JSON_KEEPALIVE_INTERVAL_MS } from "../config/runtimeConfig.js";

const encoder = new TextEncoder();
const KEEPALIVE_CHUNK = " \n";

async function writeResponseBody(controller, response) {
  if (!response?.body) {
    controller.enqueue(encoder.encode("null"));
    return;
  }

  const reader = response.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) controller.enqueue(value);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Return JSON response immediately and keep the downstream proxy alive while
 * expensive non-stream conversion buffers upstream. Leading JSON whitespace is
 * valid, so clients still parse the final document normally.
 */
export function createJsonKeepaliveResponse(resultPromise, { intervalMs = JSON_KEEPALIVE_INTERVAL_MS } = {}) {
  if (intervalMs <= 0) return resultPromise;

  const settled = resultPromise.then(
    (result) => ({ settled: true, result }),
    (error) => ({ settled: true, error })
  );

  return Promise.race([
    settled,
    new Promise((resolve) => setTimeout(() => resolve({ settled: false }), intervalMs))
  ]).then((first) => {
    if (first.settled) {
      if (first.error) throw first.error;
      return first.result;
    }

    return createStreamingJsonKeepaliveResponse(settled, intervalMs);
  });
}

function createStreamingJsonKeepaliveResponse(settledPromise, intervalMs) {
  let timer = null;
  const clearTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(KEEPALIVE_CHUNK));
      timer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(KEEPALIVE_CHUNK));
        } catch {
          clearTimer();
        }
      }, intervalMs);

      settledPromise.then(async ({ result, error }) => {
        clearTimer();
        if (error) throw error;
        await writeResponseBody(controller, result?.response);
        controller.close();
      }).catch((err) => {
        clearTimer();
        const message = err?.message || "Failed to build JSON response";
        controller.enqueue(encoder.encode(JSON.stringify({ error: { message, type: "server_error", code: "internal_server_error" } })));
        controller.close();
      });
    },
    cancel() {
      clearTimer();
    }
  });

  return {
    success: true,
    response: new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*"
      }
    })
  };
}
