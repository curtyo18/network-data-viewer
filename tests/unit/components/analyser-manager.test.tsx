import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chromeMock, renderComponent } from "./test-utils";
import { AnalyserManager } from "@/side-panel/components/AnalyserManager";
import type { AnalyserConfig } from "@/shared/types";

const BASE: AnalyserConfig = {
  id: "a1",
  name: "My Analyser",
  enabled: true,
  urlPattern: "example\\.com",
  source: "reqBody",
  dsl: [],
  createdAt: 1000,
};

function makeAnalyser(overrides: Partial<AnalyserConfig> = {}): AnalyserConfig {
  return { ...BASE, ...overrides };
}

beforeEach(() => {
  chromeMock.reset();
  chromeMock.install();
});

describe("AnalyserManager", () => {
  it("renders a list of analysers from storage", async () => {
    const cfg = makeAnalyser();
    chromeMock.setStored("analyserConfigs", [cfg]);

    const { unmount } = renderComponent(<AnalyserManager onEdit={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("My Analyser")).toBeInTheDocument();
    });

    unmount();
  });

  it("displays analyser count", async () => {
    chromeMock.setStored("analyserConfigs", [
      makeAnalyser(),
      makeAnalyser({ id: "a2", name: "Second" }),
    ]);

    const { unmount } = renderComponent(<AnalyserManager onEdit={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Analysers \(2\)/)).toBeInTheDocument();
    });

    unmount();
  });

  it("toggle checkbox flips enabled in storage", async () => {
    const user = userEvent.setup();
    const cfg = makeAnalyser({ enabled: true });
    chromeMock.setStored("analyserConfigs", [cfg]);

    const { unmount } = renderComponent(<AnalyserManager onEdit={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("My Analyser")).toBeInTheDocument();
    });

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    await waitFor(() => {
      const stored = chromeMock.getStored("analyserConfigs") as AnalyserConfig[];
      expect(stored[0].enabled).toBe(false);
    });

    unmount();
  });

  it("two rapid toggles do not lose the second flip", async () => {
    const user = userEvent.setup();
    const cfg = makeAnalyser({ enabled: true });
    chromeMock.setStored("analyserConfigs", [cfg]);

    const { unmount } = renderComponent(<AnalyserManager onEdit={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("My Analyser")).toBeInTheDocument();
    });

    const checkbox = screen.getByRole("checkbox");

    // First toggle: true → false
    await user.click(checkbox);
    await waitFor(() => {
      const stored = chromeMock.getStored("analyserConfigs") as AnalyserConfig[];
      expect(stored[0].enabled).toBe(false);
    });

    // Second toggle: false → true
    await user.click(checkbox);
    await waitFor(() => {
      const stored = chromeMock.getStored("analyserConfigs") as AnalyserConfig[];
      expect(stored[0].enabled).toBe(true);
    });

    unmount();
  });

  it("edit button calls onEdit with the analyser", async () => {
    const user = userEvent.setup();
    const cfg = makeAnalyser();
    chromeMock.setStored("analyserConfigs", [cfg]);
    const onEdit = vi.fn();

    const { unmount } = renderComponent(<AnalyserManager onEdit={onEdit} />);

    await waitFor(() => {
      expect(screen.getByText("My Analyser")).toBeInTheDocument();
    });

    await user.click(screen.getByText("edit"));

    expect(onEdit).toHaveBeenCalledWith(cfg);

    unmount();
  });

  it("remove button removes analyser from storage", async () => {
    const user = userEvent.setup();
    const cfg = makeAnalyser();
    chromeMock.setStored("analyserConfigs", [cfg]);

    const { unmount } = renderComponent(<AnalyserManager onEdit={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("My Analyser")).toBeInTheDocument();
    });

    await user.click(screen.getByText("×"));

    await waitFor(() => {
      const stored = chromeMock.getStored("analyserConfigs") as AnalyserConfig[];
      expect(stored).toHaveLength(0);
    });

    unmount();
  });

  it("error badge appears when sendMessage returns errors for the analyser id", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    chromeMock.reset();
    chromeMock.install();

    const cfg = makeAnalyser();
    chromeMock.setStored("analyserConfigs", [cfg]);
    chromeMock.runtimeSendMessage.mockResolvedValue({
      errors: {
        a1: [{ ts: Date.now(), stage: "dsl", message: "bad decode" }],
      },
    });

    const { unmount } = renderComponent(<AnalyserManager onEdit={() => {}} />);

    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /1 errors/ })).toBeInTheDocument();
    }, { timeout: 3000 });

    unmount();
    vi.useRealTimers();
  });

  it("clicking error badge expands the row and shows last error", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    chromeMock.reset();
    chromeMock.install();

    const now = 1748000000000;
    const cfg = makeAnalyser();
    chromeMock.setStored("analyserConfigs", [cfg]);
    chromeMock.runtimeSendMessage.mockResolvedValue({
      errors: {
        a1: [{ ts: now, stage: "dsl", message: "bad decode" }],
      },
    });

    const { unmount } = renderComponent(<AnalyserManager onEdit={() => {}} />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });

    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /1 errors/ })).toBeInTheDocument();
    }, { timeout: 3000 });

    await user.click(screen.getByRole("button", { name: /1 errors/ }));

    await waitFor(() => {
      expect(screen.getByText("[dsl]", { exact: false })).toBeInTheDocument();
      expect(screen.getByText("bad decode")).toBeInTheDocument();
    });

    unmount();
    vi.useRealTimers();
  });
});
