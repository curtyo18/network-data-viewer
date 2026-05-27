import "./styles.css";
import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEventStream } from "./lib/port";
import { useExport } from "./lib/use-export";
import { useAnalysers } from "./lib/use-analysers";
import { EventList } from "./components/EventList";
import { AnalyserManager } from "./components/AnalyserManager";
import { ConfigEditor } from "./components/ConfigEditor";
import { ImportDialog } from "./components/ImportDialog";
import { ExportButton } from "./components/ExportButton";
import type { AnalyserConfig } from "@/shared/types";
import { DEFAULT_SETTINGS, STORAGE_KEY_SETTINGS, mergeSettings, type Settings } from "@/shared/settings";

type Mode =
  | { kind: "events" }
  | { kind: "manage" }
  | { kind: "edit"; cfg: AnalyserConfig | null }
  | { kind: "import" };

function App() {
  const { events, clear: clearEvents } = useEventStream();
  const [mode, setMode] = useState<Mode>({ kind: "events" });
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [filter, setFilter] = useState("");
  const filterInputRef = useRef<HTMLInputElement>(null);
  const { copy: exportCopy } = useExport();
  const { analysers } = useAnalysers();

  function openEditFor(id: string) {
    const cfg = analysers.find(a => a.id === id);
    if (cfg) setMode({ kind: "edit", cfg });
  }

  const filteredEvents = useMemo(() => {
    if (!filter.trim()) return events;
    const needle = filter.toLowerCase();
    return events.filter(r =>
      r.analyserName.toLowerCase().includes(needle) ||
      r.event.method.toLowerCase().includes(needle) ||
      r.event.url.toLowerCase().includes(needle)
    );
  }, [events, filter]);

  useEffect(() => {
    let cancelled = false;
    chrome.storage.local.get(STORAGE_KEY_SETTINGS).then(res => {
      if (cancelled) return;
      const stored = res[STORAGE_KEY_SETTINGS] as Partial<Settings> | undefined;
      setSettings(mergeSettings(stored));
    });
    const onChange = (changes: { [k: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && changes[STORAGE_KEY_SETTINGS]) {
        const next = changes[STORAGE_KEY_SETTINGS].newValue as Partial<Settings> | undefined;
        setSettings(mergeSettings(next));
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey;
      if (e.key === "Escape" && (mode.kind === "edit" || mode.kind === "import")) {
        e.preventDefault();
        setMode({ kind: "manage" });
        return;
      }
      if (meta && e.key.toLowerCase() === "l" && mode.kind === "events") {
        e.preventDefault();
        clearEvents();
        return;
      }
      if (meta && e.key.toLowerCase() === "f" && mode.kind === "events") {
        if (filterInputRef.current) { e.preventDefault(); filterInputRef.current.focus(); }
        return;
      }
      if (meta && e.key.toLowerCase() === "e" && mode.kind === "events") {
        e.preventDefault();
        void exportCopy();
        return;
      }
      if (meta && e.key.toLowerCase() === "p" && mode.kind === "events") {
        // Chrome's default Ctrl+P opens the print dialog; preventDefault should win in the side-panel surface.
        // If it doesn't, we'll bikeshed the binding later.
        e.preventDefault();
        void togglePaused();
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, clearEvents, exportCopy, settings.paused]);

  async function togglePaused() {
    const previous = settings;
    const next: Settings = { ...previous, paused: !previous.paused };
    setSettings(next);
    try {
      await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: next });
    } catch (e) {
      console.error("[settings] failed to persist paused toggle", e);
      setSettings(previous);
    }
  }

  async function toggleShowRaw() {
    const previous = settings;
    const next: Settings = { ...previous, showRaw: !previous.showRaw };
    setSettings(next);
    try {
      await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: next });
    } catch (e) {
      console.error("[settings] failed to persist showRaw toggle", e);
      setSettings(previous);
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
          <button
            className="px-2 py-1 text-xs bg-slate-800 rounded text-slate-200"
            onClick={togglePaused}
            title={settings.paused ? "Resume capture (Ctrl+P)" : "Pause capture (Ctrl+P)"}
            aria-label={settings.paused ? "Resume capture" : "Pause capture"}
          >
            {settings.paused ? "▶ Resume" : "❚❚ Pause"}
          </button>
          <label className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-800 rounded text-slate-200 cursor-pointer">
            <input type="checkbox" checked={settings.showRaw} onChange={toggleShowRaw} />
            show raw
          </label>
          {mode.kind === "events" && events.length > 0 && (
            <button
              className="px-2 py-1 text-xs bg-slate-800 rounded text-slate-200"
              onClick={clearEvents}
              aria-label="Clear events"
              title="Clear (Ctrl+L)"
            >
              Clear
            </button>
          )}
          <button className="px-2 py-1 text-xs bg-slate-800 rounded text-slate-200" onClick={() => setMode({ kind: "import" })}>Import</button>
          <ExportButton />
        </div>
      </header>
      {settings.paused && (
        <div className="px-2 py-1 text-xs bg-amber-900/40 text-amber-200 border-b border-amber-800/50">
          Capture paused — no new events will be recorded.
        </div>
      )}
      {mode.kind === "events" && events.length > 0 && (
        <div className="px-2 pt-2 pb-1 border-b border-slate-800">
          <input
            ref={filterInputRef}
            type="text"
            placeholder="filter url / method / analyser…"
            className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-xs font-mono"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            aria-label="Filter events"
            data-testid="event-filter"
          />
        </div>
      )}
      <main className="flex-1 overflow-hidden">
        {mode.kind === "events" && <EventList events={filteredEvents} filter={filter} onEditAnalyser={openEditFor} />}
        {mode.kind === "manage" && <AnalyserManager onEdit={cfg => setMode({ kind: "edit", cfg })} />}
        {mode.kind === "edit" && <ConfigEditor initial={mode.cfg} onClose={() => setMode({ kind: "manage" })} />}
        {mode.kind === "import" && <ImportDialog onClose={() => setMode({ kind: "manage" })} />}
      </main>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
