import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { chromeMock, renderComponent } from "./test-utils";
import { EventList } from "@/entrypoints/sidepanel/components/EventList";
import type { MatchResult } from "@/shared/types";

// happy-dom has no layout engine, so @tanstack/react-virtual returns 0 virtual
// items (scroll container has height 0). Mock the hook to return all items so
// the cards actually render and can be asserted against.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count, getItemKey }: { count: number; getItemKey?: (i: number) => string | number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: getItemKey ? getItemKey(i) : i,
        start: i * 100,
        size: 100,
      })),
    getTotalSize: () => count * 100,
    measureElement: () => undefined,
  }),
}));

function makeEvent(id: string, url: string): MatchResult {
  return {
    analyserId: "a1",
    analyserName: "Test Analyser",
    event: {
      id,
      ts: 1000,
      method: "GET",
      url,
      source: "fetch",
      reqHeaders: {},
      resHeaders: {},
      reqBody: null,
      resBody: null,
      resStatus: 200,
    },
    dslOutput: {},
    latencyMs: 0,
  } as unknown as MatchResult;
}

beforeEach(() => {
  chromeMock.reset();
  chromeMock.install();
});

describe("EventList", () => {
  it("renders one card per event, addressed by stable id", async () => {
    const events = [makeEvent("e2", "https://x.test/b"), makeEvent("e1", "https://x.test/a")];
    const { unmount } = renderComponent(<EventList events={events} />);

    await waitFor(() => {
      expect(screen.getByText("https://x.test/a")).toBeInTheDocument();
      expect(screen.getByText("https://x.test/b")).toBeInTheDocument();
    });
    unmount();
  });

  it("re-renders correctly after an event is prepended (index shift)", async () => {
    const initial = [makeEvent("e1", "https://x.test/a")];
    const { rerender, unmount } = renderComponent(<EventList events={initial} />);
    await waitFor(() => expect(screen.getByText("https://x.test/a")).toBeInTheDocument());

    const prepended = [makeEvent("e2", "https://x.test/b"), ...initial];
    rerender(<EventList events={prepended} />);

    await waitFor(() => {
      expect(screen.getByText("https://x.test/a")).toBeInTheDocument();
      expect(screen.getByText("https://x.test/b")).toBeInTheDocument();
    });
    unmount();
  });
});
