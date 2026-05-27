import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chromeMock, renderComponent } from "./test-utils";
import { AnalyserManager } from "@/side-panel/components/AnalyserManager";
import { decodeConfig } from "@/shared/share";
import type { AnalyserConfig } from "@/shared/types";

const BASE: AnalyserConfig = {
  id: "a1",
  name: "My Analyser",
  enabled: true,
  urlPattern: "example\\.com",
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

  it("share button calls clipboard.writeText with a dvw:2: string for that analyser", async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");

    const cfg = makeAnalyser();
    chromeMock.setStored("analyserConfigs", [cfg]);

    const { unmount } = renderComponent(<AnalyserManager onEdit={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("My Analyser")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Copy share string for My Analyser/ }));

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledOnce();
    });

    const calledWith = writeTextSpy.mock.calls[0][0];
    expect(calledWith).toMatch(/^dvw:2:/);

    const decoded = decodeConfig(calledWith);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].id).toBe("a1");

    writeTextSpy.mockRestore();
    unmount();
  });

  it("share button string decodes to only that analyser when multiple exist", async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");

    const cfg1 = makeAnalyser();
    const cfg2 = makeAnalyser({ id: "a2", name: "Second" });
    chromeMock.setStored("analyserConfigs", [cfg1, cfg2]);

    const { unmount } = renderComponent(<AnalyserManager onEdit={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Second")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Copy share string for Second/ }));

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledOnce();
    });

    const decoded = decodeConfig(writeTextSpy.mock.calls[0][0]);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].id).toBe("a2");

    writeTextSpy.mockRestore();
    unmount();
  });

  it("share button label flips to 'Copied!' then reverts after timeout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const cfg = makeAnalyser();
    chromeMock.setStored("analyserConfigs", [cfg]);

    const { unmount } = renderComponent(<AnalyserManager onEdit={() => {}} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Copy share string for My Analyser/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Copy share string for My Analyser/ }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Copy share string for My Analyser/ })).toHaveTextContent("Copied!");
    }, { timeout: 500 });

    await act(async () => {
      vi.advanceTimersByTime(1600);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Copy share string for My Analyser/ })).toHaveTextContent("share");
    }, { timeout: 500 });

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
