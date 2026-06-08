import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, within } from "@testing-library/react";
import { highlight } from "@/entrypoints/sidepanel/lib/highlight";

afterEach(() => { cleanup(); });

function renderHighlight(text: string, needle: string) {
  const { container } = render(<span>{highlight(text, needle)}</span>);
  return within(container);
}

describe("highlight", () => {
  it("empty needle returns the original text verbatim", () => {
    const q = renderHighlight("hello world", "");
    expect(q.getByText("hello world")).toBeInTheDocument();
    expect(q.queryAllByRole("mark")).toHaveLength(0);
  });

  it("no match returns the original text verbatim", () => {
    const q = renderHighlight("hello world", "xyz");
    expect(q.getByText("hello world")).toBeInTheDocument();
    expect(q.queryAllByRole("mark")).toHaveLength(0);
  });

  it("single match wraps matching substring in a mark element", () => {
    const q = renderHighlight("hello world", "world");
    const marks = q.getAllByRole("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent("world");
  });

  it("multiple matches wrap all occurrences in mark elements", () => {
    const q = renderHighlight("abcabc", "abc");
    const marks = q.getAllByRole("mark");
    expect(marks).toHaveLength(2);
    marks.forEach(m => expect(m).toHaveTextContent("abc"));
  });

  it("match is case-insensitive (uppercase needle against lowercase text)", () => {
    const q = renderHighlight("hello world", "WORLD");
    const marks = q.getAllByRole("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent("world");
  });

  it("match at start of string", () => {
    const q = renderHighlight("foobar", "foo");
    const marks = q.getAllByRole("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent("foo");
  });

  it("match at end of string", () => {
    const q = renderHighlight("foobar", "bar");
    const marks = q.getAllByRole("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent("bar");
  });
});
