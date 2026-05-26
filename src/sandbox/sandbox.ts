let cachedFn: ((input: unknown, settings: unknown) => unknown) | null = null;

window.addEventListener("message", (ev: MessageEvent) => {
  const msg = ev.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "init") {
    try {
      cachedFn = new Function("input", "settings", msg.code) as (input: unknown, settings: unknown) => unknown;
      (ev.source as Window).postMessage({ type: "ready", analyserId: msg.analyserId }, "*");
    } catch (e) {
      (ev.source as Window).postMessage({ type: "init-error", analyserId: msg.analyserId, message: (e as Error).message }, "*");
    }
    return;
  }

  if (msg.type === "run") {
    const { requestId, input, settings } = msg;
    if (!cachedFn) {
      (ev.source as Window).postMessage({ type: "result", requestId, error: "sandbox not initialised" }, "*");
      return;
    }
    try {
      const result = cachedFn(input, settings);
      (ev.source as Window).postMessage({ type: "result", requestId, result }, "*");
    } catch (e) {
      (ev.source as Window).postMessage({ type: "result", requestId, error: (e as Error).message }, "*");
    }
  }
});
