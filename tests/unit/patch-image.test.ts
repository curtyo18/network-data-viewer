import { describe, it, expect, beforeEach } from "vitest";
import { installImageCapture } from "@/content/patch-image";

const BASE = "https://shop.example.com/page";

// A minimal stand-in for HTMLImageElement.prototype: a configurable `src`
// accessor backed by a per-instance store, so we exercise installImageCapture's
// descriptor handling without depending on a DOM implementation's internals.
function makeImageProto(): object {
  const backing = new WeakMap<object, unknown>();
  const proto = {};
  Object.defineProperty(proto, "src", {
    configurable: true,
    enumerable: true,
    get(this: object) { return backing.get(this) ?? ""; },
    set(this: object, v: unknown) { backing.set(this, v); },
  });
  return proto;
}

describe("installImageCapture", () => {
  let proto: object;
  let emitted: string[];

  beforeEach(() => {
    proto = makeImageProto();
    emitted = [];
    installImageCapture(proto, (url) => emitted.push(url), BASE);
  });

  function newImg(): { src: unknown } {
    return Object.create(proto) as { src: unknown };
  }

  it("emits the resolved http(s) URL when src is assigned", () => {
    const img = newImg();
    img.src = "https://www.facebook.com/tr/?id=1&ev=PageView";
    expect(emitted).toEqual(["https://www.facebook.com/tr/?id=1&ev=PageView"]);
  });

  it("preserves the getter — reading src returns the raw assigned value", () => {
    const img = newImg();
    img.src = "https://www.facebook.com/tr/?id=1&ev=PageView";
    expect(img.src).toBe("https://www.facebook.com/tr/?id=1&ev=PageView");
  });

  it("dedups identical URLs (lazy-load swaps / re-renders) but not distinct ones", () => {
    const img = newImg();
    img.src = "https://cdn.example.com/logo.png";
    img.src = "https://cdn.example.com/logo.png";
    img.src = "https://cdn.example.com/logo.png";
    expect(emitted).toHaveLength(1);
    img.src = "https://cdn.example.com/hero.png";
    expect(emitted).toHaveLength(2);
  });

  it("resolves and emits a relative src against the base URI", () => {
    const img = newImg();
    img.src = "/i/track?id=9";
    expect(emitted).toEqual(["https://shop.example.com/i/track?id=9"]);
  });

  it("does not emit for data:, blob:, or empty-string resets", () => {
    const img = newImg();
    img.src = "data:image/gif;base64,R0lGODlh";
    img.src = "blob:https://shop.example.com/abc-123";
    img.src = "";
    expect(emitted).toEqual([]);
  });

  it("never throws into the page and still assigns when toString throws", () => {
    const img = newImg();
    const hostile = { toString() { throw new Error("boom"); } };
    expect(() => { (img as { src: unknown }).src = hostile; }).not.toThrow();
    expect(emitted).toEqual([]);
    // The native setter still ran — the raw value was forwarded.
    expect(img.src).toBe(hostile);
  });

  it("forwards the raw value (not the coerced string) to the native setter", () => {
    // A wrapper object (stand-in for a TrustedURL) must reach the backing store
    // intact rather than being replaced by its stringified form.
    const img = newImg();
    const wrapped = { toString() { return "https://www.facebook.com/tr/?id=2&ev=Lead"; } };
    img.src = wrapped;
    expect(emitted).toEqual(["https://www.facebook.com/tr/?id=2&ev=Lead"]);
    expect(img.src).toBe(wrapped); // raw object preserved, not "https://…"
  });

  it("is a no-op when the prototype has no src setter", () => {
    const plain = {};
    expect(() => installImageCapture(plain, () => {}, BASE)).not.toThrow();
  });
});
