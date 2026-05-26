import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { EventCard } from "./EventCard";
import type { MatchResult } from "@/shared/types";

export function EventList({ events }: { events: MatchResult[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,        // average row height; rows expand on click
    overscan: 8,
  });

  if (events.length === 0) {
    return <div className="text-slate-500 text-sm p-4">No captured events yet. Open a page and trigger network calls matching an enabled analyser.</div>;
  }

  return (
    <div ref={parentRef} className="h-full overflow-y-auto p-2">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map(vi => (
          <div
            key={`${events[vi.index].event.id}-${events[vi.index].analyserId}`}
            data-index={vi.index}
            ref={virtualizer.measureElement}
            style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${vi.start}px)` }}
          >
            <EventCard r={events[vi.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
