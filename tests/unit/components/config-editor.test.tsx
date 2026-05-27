import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chromeMock, renderComponent } from "./test-utils";
import { ConfigEditor } from "@/side-panel/components/ConfigEditor";
import type { AnalyserConfig } from "@/shared/types";

const BASE: AnalyserConfig = {
  id: "cfg-1",
  name: "Test Analyser",
  enabled: true,
  urlPattern: "example\\.com",
  dsl: [],
  createdAt: 1000,
};

beforeEach(() => {
  chromeMock.reset();
  chromeMock.install();
});

describe("ConfigEditor", () => {
  it("renders a blank form for initial: null with a generated id", () => {
    const { unmount } = renderComponent(<ConfigEditor initial={null} onClose={() => {}} />);

    // Both name and urlPattern are empty for a new config
    const inputs = screen.getAllByRole("textbox");
    const nameInput = inputs.find(el => (el as HTMLInputElement).value === "");
    expect(nameInput).toBeTruthy();

    unmount();
  });

  it("populates form when given an existing config", () => {
    const { unmount } = renderComponent(<ConfigEditor initial={BASE} onClose={() => {}} />);

    expect(screen.getByDisplayValue("Test Analyser")).toBeInTheDocument();
    expect(screen.getByDisplayValue("example\\.com")).toBeInTheDocument();

    unmount();
  });

  it("edits to name and urlPattern update the input state", async () => {
    const user = userEvent.setup();
    const { unmount } = renderComponent(<ConfigEditor initial={BASE} onClose={() => {}} />);

    const nameInput = screen.getByDisplayValue("Test Analyser");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    expect(nameInput).toHaveValue("New Name");

    const urlInput = screen.getByDisplayValue("example\\.com");
    await user.clear(urlInput);
    await user.type(urlInput, "foo\\.bar");
    expect(urlInput).toHaveValue("foo\\.bar");

    unmount();
  });

  it("adding a DSL step via the dropdown appends it", async () => {
    const user = userEvent.setup();
    const { unmount } = renderComponent(<ConfigEditor initial={BASE} onClose={() => {}} />);

    const addDropdown = screen.getByDisplayValue("+ add step…");
    await user.selectOptions(addDropdown, "json-parse");

    await waitFor(() => {
      // The added step shows as a <span> in the DSL chain list
      const stepSpan = document.querySelector(".text-violet-300");
      expect(stepSpan?.textContent).toBe("json-parse");
    });

    unmount();
  });

  it("removing a step via the × button removes it", async () => {
    const user = userEvent.setup();
    const withStep: AnalyserConfig = { ...BASE, dsl: [{ op: "json-parse" }] };
    const { unmount } = renderComponent(<ConfigEditor initial={withStep} onClose={() => {}} />);

    // The step appears as a violet span in the DSL chain
    expect(document.querySelector(".text-violet-300")?.textContent).toBe("json-parse");

    // The DSL step row has a rose × button inside the <ol>
    const stepRemoveBtn = document.querySelector("ol .text-rose-400");
    expect(stepRemoveBtn).not.toBeNull();
    await user.click(stepRemoveBtn as HTMLElement);

    await waitFor(() => {
      expect(document.querySelector(".text-violet-300")).toBeNull();
    });

    unmount();
  });

  it("invalid regex pattern → click Save → error displayed, upsert NOT called", async () => {
    const user = userEvent.setup();
    chromeMock.setStored("analyserConfigs", []);
    const invalid: AnalyserConfig = { ...BASE, urlPattern: "[invalid" };
    const onClose = vi.fn();
    const { unmount } = renderComponent(<ConfigEditor initial={invalid} onClose={onClose} />);

    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("invalid regex pattern")).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();

    const stored = chromeMock.getStored("analyserConfigs");
    expect(stored).toEqual([]);

    unmount();
  });

  it("valid config → Save → upsert called with right payload, onClose invoked", async () => {
    const user = userEvent.setup();
    chromeMock.setStored("analyserConfigs", []);
    const onClose = vi.fn();
    const { unmount } = renderComponent(<ConfigEditor initial={BASE} onClose={onClose} />);

    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    const stored = chromeMock.getStored("analyserConfigs") as AnalyserConfig[];
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("cfg-1");
    expect(stored[0].name).toBe("Test Analyser");

    unmount();
  });

  it("Run preview button is disabled when sample is empty", () => {
    const { unmount } = renderComponent(<ConfigEditor initial={BASE} onClose={() => {}} />);

    const btn = screen.getByRole("button", { name: "Run preview" });
    expect(btn).toBeDisabled();

    unmount();
  });

  it("Run preview with sample + empty DSL chain → shows input row", async () => {
    const user = userEvent.setup();
    const { unmount } = renderComponent(<ConfigEditor initial={BASE} onClose={() => {}} />);

    const textarea = screen.getByRole("textbox", { name: "DSL preview sample" });
    await user.type(textarea, "hello");

    const btn = screen.getByRole("button", { name: "Run preview" });
    await user.click(btn);

    await waitFor(() => {
      expect(screen.getByText("input")).toBeInTheDocument();
      // Preview output is rendered in a <pre> element
      const preEl = document.querySelector("pre.text-emerald-300");
      expect(preEl?.textContent).toBe("hello");
    });

    unmount();
  });

  it("Run preview with a chain that throws → shows failing step error", async () => {
    const user = userEvent.setup();
    // json-parse will fail on non-JSON input
    const withStep: AnalyserConfig = { ...BASE, dsl: [{ op: "json-parse" }] };
    const { unmount } = renderComponent(<ConfigEditor initial={withStep} onClose={() => {}} />);

    const textarea = screen.getByRole("textbox", { name: "DSL preview sample" });
    await user.type(textarea, "not-json");

    await user.click(screen.getByRole("button", { name: "Run preview" }));

    await waitFor(() => {
      const errorEl = screen.getByText(/err:/);
      expect(errorEl).toBeInTheDocument();
    });

    unmount();
  });

  it("editing the DSL chain after a preview clears the preview output", async () => {
    const user = userEvent.setup();
    const { unmount } = renderComponent(<ConfigEditor initial={BASE} onClose={() => {}} />);

    const textarea = screen.getByRole("textbox", { name: "DSL preview sample" });
    await user.type(textarea, "hello");
    await user.click(screen.getByRole("button", { name: "Run preview" }));

    await waitFor(() => {
      // Preview shows a "input" label and a <pre> with the sample value
      const preEl = document.querySelector("pre.text-emerald-300");
      expect(preEl).not.toBeNull();
    });

    // Add a step → dsl changes → useEffect clears preview
    const addDropdown = screen.getByDisplayValue("+ add step…");
    await user.selectOptions(addDropdown, "json-parse");

    await waitFor(() => {
      // After DSL change, preview section should be gone
      const preEl = document.querySelector("pre.text-emerald-300");
      expect(preEl).toBeNull();
    });

    unmount();
  });

  it("saving a config that triggers a lint warning shows the banner; upsert NOT called", async () => {
    const user = userEvent.setup();
    chromeMock.setStored("analyserConfigs", []);
    const onClose = vi.fn();
    // sandbox accesses input as object but no DSL to parse it — triggers empty-dsl-on-typed-source
    const lintCfg: AnalyserConfig = { ...BASE, dsl: [], sandboxCode: "return input.value;" };
    const { unmount } = renderComponent(<ConfigEditor initial={lintCfg} onClose={onClose} />);

    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText(/Lint warnings/)).toBeInTheDocument();
      expect(screen.getByText("Save anyway")).toBeInTheDocument();
    });

    // upsert must NOT have been called
    expect(onClose).not.toHaveBeenCalled();
    const stored = chromeMock.getStored("analyserConfigs");
    expect(stored).toEqual([]);

    unmount();
  });

  it("clicking 'Save anyway' persists the config despite lint warnings", async () => {
    const user = userEvent.setup();
    chromeMock.setStored("analyserConfigs", []);
    const onClose = vi.fn();
    const lintCfg: AnalyserConfig = { ...BASE, dsl: [], sandboxCode: "return input.value;" };
    const { unmount } = renderComponent(<ConfigEditor initial={lintCfg} onClose={onClose} />);

    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Save anyway")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Save anyway"));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });

    const stored = chromeMock.getStored("analyserConfigs") as AnalyserConfig[];
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("cfg-1");

    unmount();
  });

  it("editing any field after lint warnings clears the warning banner", async () => {
    const user = userEvent.setup();
    chromeMock.setStored("analyserConfigs", []);
    const lintCfg: AnalyserConfig = { ...BASE, dsl: [], sandboxCode: "return input.value;" };
    const { unmount } = renderComponent(<ConfigEditor initial={lintCfg} onClose={() => {}} />);

    await user.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText(/Lint warnings/)).toBeInTheDocument();
    });

    // Edit any field to clear warnings
    const nameInput = screen.getByDisplayValue("Test Analyser");
    await user.clear(nameInput);
    await user.type(nameInput, "Updated");

    await waitFor(() => {
      expect(screen.queryByText(/Lint warnings/)).not.toBeInTheDocument();
    });

    unmount();
  });
});
