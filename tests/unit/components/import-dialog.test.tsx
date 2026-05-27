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
  it("empty textarea + Decode → surfaces an error", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    chromeMock.setStored("analyserConfigs", []);

    const { unmount } = renderComponent(<ImportDialog onClose={onClose} />);

    await user.click(screen.getByText("Decode"));

    await waitFor(() => {
      expect(screen.getByText(/not a dataviewer config string/i)).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();

    unmount();
  });

  it("valid dvw:1:… string → Decode shows preview, Install writes storage and calls onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    chromeMock.setStored("analyserConfigs", []);

    const encoded = encodeConfig([SAMPLE_CONFIG]);

    const { unmount } = renderComponent(<ImportDialog onClose={onClose} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, encoded);

    await user.click(screen.getByText("Decode"));

    // Preview should appear with "Will add" section
    await waitFor(() => {
      expect(screen.getByText(/Will add 1 new/i)).toBeInTheDocument();
    });
    expect(screen.getByText("Imported Analyser")).toBeInTheDocument();

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

  it("preview shows 'Will replace' for existing id and 'Will add' for new id", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const existing: AnalyserConfig = { ...SAMPLE_CONFIG, name: "Old Name", seedVersion: 1 };
    const newAnalyser: AnalyserConfig = {
      id: "import-2",
      name: "Brand New",
      enabled: true,
      urlPattern: "new\\.test",
      source: "reqBody",
      dsl: [],
      createdAt: 3000,
    };
    chromeMock.setStored("analyserConfigs", [existing]);

    const updated: AnalyserConfig = { ...SAMPLE_CONFIG, name: "New Name", seedVersion: 2 };
    const encoded = encodeConfig([updated, newAnalyser]);

    const { unmount } = renderComponent(<ImportDialog onClose={onClose} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, encoded);
    await user.click(screen.getByText("Decode"));

    await waitFor(() => {
      expect(screen.getByText(/Will replace 1 existing/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Will add 1 new/i)).toBeInTheDocument();
    expect(screen.getByText(/v1.*v2/i)).toBeInTheDocument();
    expect(screen.getByText("Brand New")).toBeInTheDocument();

    unmount();
  });

  it("Back button on preview returns to input state with text preserved", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    chromeMock.setStored("analyserConfigs", []);

    const encoded = encodeConfig([SAMPLE_CONFIG]);

    const { unmount } = renderComponent(<ImportDialog onClose={onClose} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, encoded);
    await user.click(screen.getByText("Decode"));

    await waitFor(() => {
      expect(screen.getByText(/Will add/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText("Back"));

    // Should be back to input state
    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
    expect(screen.getByText("Decode")).toBeInTheDocument();
    // Text is preserved
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(encoded);
    expect(onClose).not.toHaveBeenCalled();

    unmount();
  });

  it("malformed string → error visible alongside textarea and Decode button, storage unchanged", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    chromeMock.setStored("analyserConfigs", []);

    const { unmount } = renderComponent(<ImportDialog onClose={onClose} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "dvw:1:NOTVALID!!!BAD");

    await user.click(screen.getByText("Decode"));

    await waitFor(() => {
      const el = document.querySelector(".text-rose-400");
      expect(el).not.toBeNull();
    });
    // Textarea and Decode button must still be present (no separate error-state view)
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByText("Decode")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    const stored = chromeMock.getStored("analyserConfigs") as AnalyserConfig[];
    expect(stored).toHaveLength(0);

    unmount();
  });

  it("existing analyser id matched by incoming id → shows replace preview, Install overwrites", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const existing: AnalyserConfig = { ...SAMPLE_CONFIG, name: "Old Name" };
    chromeMock.setStored("analyserConfigs", [existing]);

    const { unmount } = renderComponent(<ImportDialog onClose={onClose} />);

    const updated: AnalyserConfig = { ...SAMPLE_CONFIG, name: "New Name" };
    const encoded = encodeConfig([updated]);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, encoded);
    await user.click(screen.getByText("Decode"));

    await waitFor(() => {
      expect(screen.getByText(/Will replace 1 existing/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText("Install"));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    const stored = chromeMock.getStored("analyserConfigs") as AnalyserConfig[];
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("New Name");

    unmount();
  });

  it("Install is disabled when incoming matches existing (no changes)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    chromeMock.setStored("analyserConfigs", [SAMPLE_CONFIG]);

    const encoded = encodeConfig([SAMPLE_CONFIG]);

    const { unmount } = renderComponent(<ImportDialog onClose={onClose} />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, encoded);
    await user.click(screen.getByText("Decode"));

    await waitFor(() => {
      expect(screen.getByText(/No changes/i)).toBeInTheDocument();
    });

    const installBtn = screen.getByText("Install");
    expect(installBtn).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    unmount();
  });

  it("Cancel button on input state calls onClose without modifying storage", async () => {
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
