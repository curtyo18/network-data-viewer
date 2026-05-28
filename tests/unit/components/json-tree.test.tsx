import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderComponent } from "./test-utils";
import { JsonTree } from "@/side-panel/components/JsonTree";

describe("JsonTree default expansion", () => {
  it("auto-expands the first two layers and collapses deeper ones", () => {
    const data = { level1: { level2: { level3: "deep" } } };
    renderComponent(<JsonTree value={data} />);

    // Layer 1 (root's child) is visible because the root (depth 0) is open.
    expect(screen.getByText("level1:")).toBeTruthy();
    // Layer 2 is visible because depth-1 nodes are open by default too.
    expect(screen.getByText("level2:")).toBeTruthy();
    // Layer 3 is collapsed: the depth-2 node is closed, so its child key and
    // value are not rendered.
    expect(screen.queryByText("level3:")).toBeNull();
    expect(screen.queryByText(/deep/)).toBeNull();
  });

  it("renders the collapsed deeper node's header so it can still be opened", () => {
    const data = { level1: { level2: { level3: "deep" } } };
    renderComponent(<JsonTree value={data} />);
    // The depth-2 node's own header is present (collapsed marker ▸), just not its children.
    expect(screen.getByText("level2:")).toBeTruthy();
  });
});
