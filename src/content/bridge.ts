import { CapturedEventSchema } from "@/shared/schema";
import { MSG, SETUP_EVENT } from "@/shared/messages";

window.addEventListener(SETUP_EVENT, (e: Event) => {
  const port = (e as CustomEvent<MessagePort>).detail;
  port.onmessage = (ev: MessageEvent) => {
    const parsed = CapturedEventSchema.safeParse(ev.data);
    if (!parsed.success) return;
    chrome.runtime.sendMessage({ type: MSG.CAPTURED_EVENT, payload: parsed.data }).catch(() => {});
  };
  port.start();
});
