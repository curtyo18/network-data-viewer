let cachedFn: ((input: unknown) => unknown) | null = null;

window.addEventListener("message", (ev: MessageEvent) => {
  const msg = ev.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "init") {
    try {
      cachedFn = new Function("input", msg.code) as (input: unknown) => unknown;
      (ev.source as Window).postMessage({ type: "ready", analyserId: msg.analyserId }, "*");
    } catch (e) {
      (ev.source as Window).postMessage({ type: "init-error", analyserId: msg.analyserId, message: (e as Error).message }, "*");
    }
    return;
  }

  if (msg.type === "run") {
    const { requestId, input } = msg;
    if (!cachedFn) {
      (ev.source as Window).postMessage({ type: "result", requestId, error: "sandbox not initialised" }, "*");
      return;
    }
    try {
      const result = cachedFn(input);
      (ev.source as Window).postMessage({ type: "result", requestId, result }, "*");
    } catch (e) {
      (ev.source as Window).postMessage({ type: "result", requestId, error: (e as Error).message }, "*");
    }
  }
});
