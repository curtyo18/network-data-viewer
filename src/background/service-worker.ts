import { Storage } from "./storage";
import { dispatch } from "./dispatcher";
import { OffscreenManager } from "./offscreen-manager";
import { CapturedEventSchema } from "@/shared/schema";
import { STORAGE_KEY, MSG, PORT_NAME } from "@/shared/messages";
import type { AnalyserConfig, CapturedEvent, MatchResult } from "@/shared/types";
import ga4 from "@/examples/ga4.json";
import contentsquare from "@/examples/contentsquare.json";
import celebrus from "@/examples/celebrus.json";

const storage = new Storage(chrome.storage.local);
const offscreen = new OffscreenManager();
const panelPorts = new Set<chrome.runtime.Port>();
let configCache: AnalyserConfig[] | null = null;

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== PORT_NAME) return;
  panelPorts.add(port);
  port.onDisconnect.addListener(() => panelPorts.delete(port));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && STORAGE_KEY in changes) {
    configCache = changes[STORAGE_KEY].newValue as AnalyserConfig[] | undefined ?? [];
    for (const cfg of configCache) offscreen.invalidate(cfg.id);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== MSG.CAPTURED_EVENT) return false;
  void handleCapturedEvent(msg.payload, sender).then(() => sendResponse({ ok: true }));
  return true;
});

async function handleCapturedEvent(raw: unknown, sender: chrome.runtime.MessageSender): Promise<void> {
  const parsed = CapturedEventSchema.safeParse(raw);
  if (!parsed.success) return;
  const event: CapturedEvent = parsed.data;
  if (sender.tab?.id !== undefined) event.originTab = { tabId: sender.tab.id, url: sender.tab.url ?? "" };

  if (configCache === null) configCache = await storage.getAnalysers();
  const results: MatchResult[] = await dispatch(event, configCache, offscreen.run);

  if (results.length === 0 || panelPorts.size === 0) return;
  for (const r of results) {
    for (const port of panelPorts) {
      try { port.postMessage({ type: MSG.MATCH_RESULT, payload: r }); } catch { /* port may have closed */ }
    }
  }
}

chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install") return;
  const seeds: AnalyserConfig[] = [ga4, contentsquare, celebrus] as AnalyserConfig[];
  await chrome.storage.local.set({ [STORAGE_KEY]: seeds });
});
