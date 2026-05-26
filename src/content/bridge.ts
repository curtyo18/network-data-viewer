import { CapturedEventSchema } from "@/shared/schema";
import { MSG } from "@/shared/messages";

window.addEventListener("message", (ev: MessageEvent) => {
  if (ev.source !== window) return;
  const raw = (ev.data as { __dvw_event?: unknown })?.__dvw_event;
  if (raw === undefined) return;
  const parsed = CapturedEventSchema.safeParse(raw);
  if (!parsed.success) return;
  chrome.runtime.sendMessage({ type: MSG.CAPTURED_EVENT, payload: parsed.data }).catch(() => {});
});
