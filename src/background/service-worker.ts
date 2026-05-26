import { Storage } from "./storage";
import { dispatch, compileConfigs, type CompiledConfig } from "./dispatcher";
import { OffscreenManager } from "./offscreen-manager";
import { mergeSeeds } from "./merge-seeds";
import { CapturedEventSchema } from "@/shared/schema";
import { STORAGE_KEY, MSG, PORT_NAME } from "@/shared/messages";
import { STORAGE_KEY_SETTINGS, type Settings } from "@/shared/settings";
import type { AnalyserConfig, CapturedEvent, MatchResult } from "@/shared/types";
import seeds from "virtual:analyser-seeds";

const storage = new Storage(chrome.storage.local);
const offscreen = new OffscreenManager();
const panelPorts = new Set<chrome.runtime.Port>();
let configCache: CompiledConfig[] | null = null;
let settingsCache: Settings | null = null;

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== PORT_NAME) return;
  panelPorts.add(port);
  port.onDisconnect.addListener(() => panelPorts.delete(port));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (STORAGE_KEY in changes) {
    const oldConfigs = (changes[STORAGE_KEY].oldValue as AnalyserConfig[] | undefined) ?? [];
    const newConfigs = (changes[STORAGE_KEY].newValue as AnalyserConfig[] | undefined) ?? [];
    configCache = compileConfigs(newConfigs);
    const oldById = new Map(oldConfigs.map(c => [c.id, c]));
    for (const cfg of newConfigs) {
      const prev = oldById.get(cfg.id);
      if (prev?.sandboxCode !== cfg.sandboxCode) offscreen.invalidate(cfg.id);
      oldById.delete(cfg.id);
    }
    for (const removedId of oldById.keys()) offscreen.invalidate(removedId);
  }
  if (STORAGE_KEY_SETTINGS in changes) settingsCache = null;
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
  const enriched: CapturedEvent = sender.tab?.id !== undefined
    ? { ...event, originTab: { tabId: sender.tab.id, url: sender.tab.url ?? "" } }
    : event;

  if (configCache === null) configCache = compileConfigs(await storage.getAnalysers());
  if (settingsCache === null) settingsCache = await storage.getSettings();
  const results: MatchResult[] = await dispatch(enriched, configCache, settingsCache, offscreen.run);

  if (results.length === 0 || panelPorts.size === 0) return;
  for (const r of results) {
    for (const port of panelPorts) {
      try { port.postMessage({ type: MSG.MATCH_RESULT, payload: r }); } catch { /* port may have closed */ }
    }
  }
}

chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== "install" && reason !== "update") return;
  try {
    const existing = await storage.getAnalysers();
    const merged = mergeSeeds(existing, seeds);
    await storage.setAnalysers(merged);
    configCache = null; // force re-read on next dispatch
  } catch (e) {
    console.error("[seeds] migration failed; bundled seeds may not be up to date", e);
  }
});
