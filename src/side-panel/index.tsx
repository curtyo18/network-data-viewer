import "./styles.css";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { useEventStream } from "./lib/port";
import { EventList } from "./components/EventList";
import { AnalyserManager } from "./components/AnalyserManager";
import { ConfigEditor } from "./components/ConfigEditor";
import { ImportDialog } from "./components/ImportDialog";
import { ExportButton } from "./components/ExportButton";
import type { AnalyserConfig } from "@/shared/types";

type Mode =
  | { kind: "events" }
  | { kind: "manage" }
  | { kind: "edit"; cfg: AnalyserConfig | null }
  | { kind: "import" };

function App() {
  const events = useEventStream();
  const [mode, setMode] = useState<Mode>({ kind: "events" });

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between p-2 border-b border-slate-800">
        <div className="flex gap-2">
          <button className={`px-2 py-1 text-xs rounded ${mode.kind === "events" ? "bg-violet-700 text-white" : "bg-slate-800 text-slate-200"}`} onClick={() => setMode({ kind: "events" })}>events</button>
          <button className={`px-2 py-1 text-xs rounded ${mode.kind === "manage" ? "bg-violet-700 text-white" : "bg-slate-800 text-slate-200"}`} onClick={() => setMode({ kind: "manage" })}>analysers</button>
        </div>
        <div className="flex gap-2">
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
