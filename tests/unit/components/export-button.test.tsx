import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chromeMock, renderComponent } from "./test-utils";
import { ExportButton } from "@/side-panel/components/ExportButton";
import type { AnalyserConfig } from "@/shared/types";

const SAMPLE: AnalyserConfig = {
  id: "e1",
  name: "Export Test",
  enabled: true,
  urlPattern: "example\\.com",
  source: "reqBody",
  dsl: [],
  createdAt: 3000,
};

beforeEach(() => {
  chromeMock.reset();
  chromeMock.install();
});

describe("ExportButton", () => {
  it("click → clipboard.writeText called with a dvw:1: string", async () => {
    // userEvent.setup() installs its own clipboard stub on navigator.clipboard.
    // We spy on that stub's writeText after setup so our spy sees the real call.
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");

    chromeMock.setStored("analyserConfigs", [SAMPLE]);

    const { unmount } = renderComponent(<ExportButton />);

    await waitFor(() => {
      expect(screen.getByText("Export all")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Export all"));

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledOnce();
    });

    const calledWith = writeTextSpy.mock.calls[0][0];
    expect(calledWith).toMatch(/^dvw:1:/);

    writeTextSpy.mockRestore();
    unmount();
  });

  it("after click, shows 'Copied!' then reverts to 'Export all' after timeout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    chromeMock.setStored("analyserConfigs", [SAMPLE]);

    const { unmount } = renderComponent(<ExportButton />);

    // Let the hook load
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await user.click(screen.getByText("Export all"));

    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    }, { timeout: 500 });

    // Advance past the 1500ms timeout in useExport
    await act(async () => {
      vi.advanceTimersByTime(1600);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("Export all")).toBeInTheDocument();
    }, { timeout: 500 });

    unmount();
    vi.useRealTimers();
  });

  it("exports an empty list when no analysers are stored", async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");

    chromeMock.setStored("analyserConfigs", []);

    const { unmount } = renderComponent(<ExportButton />);

    await waitFor(() => {
      expect(screen.getByText("Export all")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Export all"));

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledOnce();
    });

    const calledWith = writeTextSpy.mock.calls[0][0];
    expect(calledWith).toMatch(/^dvw:1:/);

    writeTextSpy.mockRestore();
    unmount();
  });
});
