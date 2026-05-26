import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chromeMock, renderComponent } from "./test-utils";
import { ImportDialog } from "@/side-panel/components/ImportDialog";
import { encodeConfig } from "@/shared/share";
import type { AnalyserConfig } from "@/shared/types";

const SAMPLE_CONFIG: AnalyserConfig = {
  id: "import-1",
  name: "Imported Analyser",
  enabled: true,
  urlPattern: "import\\.test",
  source: "reqBody",
  dsl: [],
  createdAt: 2000,
};

beforeEach(() => {
  chromeMock.reset();
  chromeMock.install();
});

describe("ImportDialog", () => {
  it("empty textarea + Install → surfaces an error", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    chromeMock.setStored("analyserConfigs", []);

    const { unmount } = renderComponent(<ImportDialog onClose={onClose} />);

    await user.click(screen.getByText("Install"));

    await waitFor(() => {
      expect(screen.getByText(/not a dataviewer config string/i)).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();

    unmount();
  });

  it("valid dvw:1:… string → analysers written to storage; onClose called", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    chromeMock.setStored("analyserConfigs", []);

    const encoded = encodeConfig([SAMPLE_CONFIG]);

    const { unmount } = renderComponent(<ImportDialog onClose={onClose} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, encoded);

    await user.click(screen.getByText("Install"));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    const stored = chromeMock.getStored("analyserConfigs") as AnalyserConfig[];
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("import-1");
    expect(stored[0].name).toBe("Imported Analyser");

    unmount();
  });

  it("malformed string → error surfaces, storage unchanged", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    chromeMock.setStored("analyserConfigs", []);

    const { unmount } = renderComponent(<ImportDialog onClose={onClose} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "dvw:1:NOTVALID!!!BAD");

    await user.click(screen.getByText("Install"));

    await waitFor(() => {
      // Error element should appear
      const el = document.querySelector(".text-rose-400");
      expect(el).not.toBeNull();
    });
    expect(onClose).not.toHaveBeenCalled();

    const stored = chromeMock.getStored("analyserConfigs") as AnalyserConfig[];
    expect(stored).toHaveLength(0);

    unmount();
  });

  it("existing analyser id matched by incoming id → silently overwritten", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const existing: AnalyserConfig = { ...SAMPLE_CONFIG, name: "Old Name" };
    chromeMock.setStored("analyserConfigs", [existing]);

    // Wait for the hook to load
    const { unmount } = renderComponent(<ImportDialog onClose={onClose} />);

    const updated: AnalyserConfig = { ...SAMPLE_CONFIG, name: "New Name" };
    const encoded = encodeConfig([updated]);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, encoded);

    await user.click(screen.getByText("Install"));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    const stored = chromeMock.getStored("analyserConfigs") as AnalyserConfig[];
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("New Name");

    unmount();
  });

  it("Cancel button calls onClose without modifying storage", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    chromeMock.setStored("analyserConfigs", []);

    const { unmount } = renderComponent(<ImportDialog onClose={onClose} />);

    await user.click(screen.getByText("Cancel"));

    expect(onClose).toHaveBeenCalled();
    const stored = chromeMock.getStored("analyserConfigs") as AnalyserConfig[];
    expect(stored).toHaveLength(0);

    unmount();
  });
});
