import { EventCard } from "./EventCard";
import type { MatchResult } from "@/shared/types";

export function EventList({ events }: { events: MatchResult[] }) {
  if (events.length === 0) {
    return <div className="text-slate-500 text-sm p-4">No captured events yet. Open a page and trigger network calls matching an enabled analyser.</div>;
  }
  return (
    <div className="overflow-y-auto p-2">
      {events.map(r => <EventCard key={`${r.event.id}-${r.analyserId}`} r={r} />)}
    </div>
  );
}
