import { CapturedEventSchema } from "@/shared/schema";
import { MSG } from "@/shared/messages";

console.log("[dvw-bridge] script loaded");

window.addEventListener("message", (ev: MessageEvent) => {
  if (ev.source !== window) return;
  const raw = (ev.data as { __dvw_event?: unknown })?.__dvw_event;
  if (raw === undefined) return;
  const parsed = CapturedEventSchema.safeParse(raw);
  if (!parsed.success) {
    console.log("[dvw-bridge] schema reject:", parsed.error.errors[0]?.message);
    return;
  }
  console.log("[dvw-bridge] forwarding event:", parsed.data.url);
  chrome.runtime.sendMessage({ type: MSG.CAPTURED_EVENT, payload: parsed.data }).catch((err) => {
    console.log("[dvw-bridge] sendMessage error:", (err as Error).message);
  });
});
