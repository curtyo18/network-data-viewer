import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { chromeMock, renderComponent } from "./test-utils";
import { ConfigMenu } from "@/side-panel/components/ConfigMenu";

beforeEach(() => {
  chromeMock.reset();
  chromeMock.install();
});

function setup(overrides: Partial<React.ComponentProps<typeof ConfigMenu>> = {}) {
  const props = {
    showRaw: false,
    onToggleShowRaw: vi.fn(),
    onImport: vi.fn(),
    ...overrides,
  };
  const utils = renderComponent(<ConfigMenu {...props} />);
  return { props, ...utils };
}

describe("ConfigMenu", () => {
  it("is closed initially: items are not visible", () => {
    const { unmount } = setup();
    expect(screen.queryByText("show raw")).not.toBeInTheDocument();
    expect(screen.queryByText("Import")).not.toBeInTheDocument();
    unmount();
  });

  it("clicking the gear opens the panel with all three items", async () => {
    const user = userEvent.setup();
    const { unmount } = setup();
    await user.click(screen.getByRole("button", { name: "Config" }));
    expect(screen.getByText("show raw")).toBeInTheDocument();
    expect(screen.getByText("Import")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Export all")).toBeInTheDocument());
    unmount();
  });

  it("toggling show raw calls onToggleShowRaw and keeps the menu open", async () => {
    const user = userEvent.setup();
    const { props, unmount } = setup();
    await user.click(screen.getByRole("button", { name: "Config" }));
    await user.click(screen.getByLabelText("show raw"));
    expect(props.onToggleShowRaw).toHaveBeenCalledOnce();
    expect(screen.getByText("Import")).toBeInTheDocument(); // still open
    unmount();
  });

  it("clicking Import calls onImport and closes the menu", async () => {
    const user = userEvent.setup();
    const { props, unmount } = setup();
    await user.click(screen.getByRole("button", { name: "Config" }));
    await user.click(screen.getByText("Import"));
    expect(props.onImport).toHaveBeenCalledOnce();
    expect(screen.queryByText("Import")).not.toBeInTheDocument(); // closed
    unmount();
  });
});
