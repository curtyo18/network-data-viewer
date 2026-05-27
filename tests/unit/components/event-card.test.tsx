import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chromeMock, renderComponent } from "./test-utils";
import { EventCard } from "@/side-panel/components/EventCard";
import type { MatchResult } from "@/shared/types";

const BASE_RESULT: MatchResult = {
  analyserId: "a1",
  analyserName: "My Analyser",
  event: {
    id: "ev1",
    ts: 1748000000000,
    url: "https://example.com/collect",
    method: "POST",
    source: "fetch",
    reqHeaders: {},
    reqBody: null,
    resStatus: 200,
    resHeaders: {},
    resBody: null,
  },
  dslOutput: { key: "value" },
  latencyMs: 12,
};

beforeEach(() => {
  chromeMock.reset();
  chromeMock.install();
});

describe("EventCard", () => {
  it("renders the analyser name as a button when onEditAnalyser is supplied", () => {
    const { unmount } = renderComponent(
      <EventCard r={BASE_RESULT} onEditAnalyser={() => {}} />
    );

    const btn = screen.getByRole("button", { name: /Edit analyser My Analyser/ });
    expect(btn).toBeInTheDocument();
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveTextContent("My Analyser");

    unmount();
  });

  it("clicking the button calls onEditAnalyser with the correct analyserId", async () => {
    const user = userEvent.setup();
    const onEditAnalyser = vi.fn();

    const { unmount } = renderComponent(
      <EventCard r={BASE_RESULT} onEditAnalyser={onEditAnalyser} />
    );

    const btn = screen.getByRole("button", { name: /Edit analyser My Analyser/ });
    await user.click(btn);

    expect(onEditAnalyser).toHaveBeenCalledOnce();
    expect(onEditAnalyser).toHaveBeenCalledWith("a1");

    unmount();
  });

  it("renders the analyser name as plain text when onEditAnalyser is not supplied", () => {
    const { unmount } = renderComponent(
      <EventCard r={BASE_RESULT} />
    );

    // No button should be present for the analyser name
    expect(screen.queryByRole("button", { name: /Edit analyser/ })).toBeNull();
    // The name should still appear in the document
    expect(screen.getByText("My Analyser")).toBeInTheDocument();

    unmount();
  });

  it("the button has the correct aria-label", () => {
    const { unmount } = renderComponent(
      <EventCard r={BASE_RESULT} onEditAnalyser={() => {}} />
    );

    const btn = screen.getByRole("button", { name: "Edit analyser My Analyser" });
    expect(btn).toHaveAttribute("aria-label", "Edit analyser My Analyser");

    unmount();
  });
});
