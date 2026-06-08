import { CapturedEventSchema } from "@/shared/schema";
import { MSG } from "@/shared/messages";

export default defineContentScript({
  matches: ['<all_urls>'],
  world: 'ISOLATED',
  runAt: 'document_start',
  allFrames: true,
  main() {
    window.addEventListener("message", (ev: MessageEvent) => {
      if (ev.source !== window) return;
      const raw = (ev.data as { __dvw_event?: unknown })?.__dvw_event;
      if (raw === undefined) return;
      const parsed = CapturedEventSchema.safeParse(raw);
      if (!parsed.success) return;
      try {
        chrome.runtime.sendMessage({ type: MSG.CAPTURED_EVENT, payload: parsed.data }).catch(() => {});
      } catch { /* SW context invalidated — drop silently */ }
    });
  },
});
