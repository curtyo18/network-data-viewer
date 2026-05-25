import { CapturedEventSchema } from "@/shared/schema";

window.addEventListener("__dvw_setup__", (e: Event) => {
  const port = (e as CustomEvent<MessagePort>).detail;
  port.onmessage = (ev: MessageEvent) => {
    const parsed = CapturedEventSchema.safeParse(ev.data);
    if (!parsed.success) return;
    chrome.runtime.sendMessage({ type: "captured-event", payload: parsed.data }).catch(() => {});
  };
  port.start();
});
