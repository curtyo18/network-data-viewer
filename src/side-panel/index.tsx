import "./styles.css";
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { useEventStream } from "./lib/port";
import { EventList } from "./components/EventList";
import { AnalyserManager } from "./components/AnalyserManager";
import { ConfigEditor } from "./components/ConfigEditor";
import { ImportDialog } from "./components/ImportDialog";
import { ExportButton } from "./components/ExportButton";
import type { AnalyserConfig } from "@/shared/types";
import { DEFAULT_SETTINGS, STORAGE_KEY_SETTINGS, type Settings } from "@/shared/settings";

type Mode =
  | { kind: "events" }
  | { kind: "manage" }
  | { kind: "edit"; cfg: AnalyserConfig | null }
  | { kind: "import" };

function App() {
  const events = useEventStream();
  const [mode, setMode] = useState<Mode>({ kind: "events" });
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    chrome.storage.local.get(STORAGE_KEY_SETTINGS).then(res => {
      if (cancelled) return;
      const stored = res[STORAGE_KEY_SETTINGS] as Partial<Settings> | undefined;
      setSettings({ ...DEFAULT_SETTINGS, ...(stored ?? {}) });
    });
    const onChange = (changes: { [k: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && changes[STORAGE_KEY_SETTINGS]) {
        const next = changes[STORAGE_KEY_SETTINGS].newValue as Partial<Settings> | undefined;
        setSettings({ ...DEFAULT_SETTINGS, ...(next ?? {}) });
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, []);

  async function toggleShowRaw() {
    let next: Settings | null = null;
    setSettings(prev => {
      next = { ...prev, showRaw: !prev.showRaw };
      return next;
    });
    if (next === null) return;
    try {
      await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: next });
    } catch (e) {
      console.error("[settings] failed to persist showRaw toggle", e);
      setSettings(prev => ({ ...prev, showRaw: !prev.showRaw }));  // revert
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between p-2 border-b border-slate-800">
        <div className="flex gap-2">
          <button className={`px-2 py-1 text-xs rounded ${mode.kind === "events" ? "bg-violet-700 text-white" : "bg-slate-800 text-slate-200"}`} onClick={() => setMode({ kind: "events" })}>events</button>
          <button className={`px-2 py-1 text-xs rounded ${mode.kind === "manage" ? "bg-violet-700 text-white" : "bg-slate-800 text-slate-200"}`} onClick={() => setMode({ kind: "manage" })}>analysers</button>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-800 rounded text-slate-200 cursor-pointer">
            <input type="checkbox" checked={settings.showRaw} onChange={toggleShowRaw} />
            show raw
          </label>
          <button className="px-2 py-1 text-xs bg-slate-800 rounded text-slate-200" onClick={() => setMode({ kind: "import" })}>Import</button>
          <ExportButton />
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {mode.kind === "events" && <EventList events={events} />}
        {mode.kind === "manage" && <AnalyserManager onEdit={cfg => setMode({ kind: "edit", cfg })} />}
        {mode.kind === "edit" && <ConfigEditor initial={mode.cfg} onClose={() => setMode({ kind: "manage" })} />}
        {mode.kind === "import" && <ImportDialog onClose={() => setMode({ kind: "manage" })} />}
      </main>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
