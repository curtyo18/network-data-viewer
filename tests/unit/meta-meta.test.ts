import { describe, it, expect } from "vitest";
import { meta } from "@/examples/meta.meta";

describe("meta meta", () => {
  const re = new RegExp(meta.urlPattern);

  it("matches the canonical Meta Pixel /tr beacon", () => {
    expect(re.test("https://www.facebook.com/tr/?id=123&ev=PageView")).toBe(true);
    expect(re.test("https://www.facebook.com/tr?id=123&ev=Purchase")).toBe(true);
    // ev before id ordering still satisfies both lookaheads
    expect(re.test("https://www.facebook.com/tr/?ev=Lead&id=999&cd[value]=10")).toBe(true);
  });

  it("matches first-party CAPI-gateway / sGTM proxies that re-front the pixel", () => {
    expect(re.test("https://sgtm.shop.example.com/tr/?id=9&ev=Lead")).toBe(true);
  });

  it("matches the direct client-side Conversions API endpoint", () => {
    expect(re.test("https://graph.facebook.com/v18.0/123456789/events")).toBe(true);
    expect(re.test("https://graph.facebook.com/v19.0/555/events?access_token=x")).toBe(true);
    // Trailing slash is a legal collection-endpoint form; must not be dropped at
    // the gate (and must agree with the sandbox's CAPI detector).
    expect(re.test("https://graph.facebook.com/v18.0/123/events/")).toBe(true);
  });

  it("does NOT match graph paths that only share the /events prefix", () => {
    expect(re.test("https://graph.facebook.com/v18.0/123/eventsXYZ")).toBe(false);
    expect(re.test("https://graph.facebook.com/v18.0/123/events_manager?a=1")).toBe(false);
  });

  it("deliberately matches /tr on ANY host (first-party gateway support)", () => {
    // Branch 1 is host-agnostic by design; the id=/ev= lookaheads are the only
    // discriminator. Documented here so the breadth is intentional, not accidental.
    expect(re.test("https://evil.example.com/tr?id=1&ev=2")).toBe(true);
  });

  it("does NOT match unrelated /tr-prefixed paths", () => {
    expect(re.test("https://example.com/translate?q=hi&id=1&ev=2")).toBe(false);
  });

  it("does NOT match a /tr beacon missing id or ev", () => {
    expect(re.test("https://www.facebook.com/tr/?ev=PageView")).toBe(false);
    expect(re.test("https://www.facebook.com/tr/?id=123")).toBe(false);
  });

  it("does NOT match the pixel library loader", () => {
    expect(re.test("https://connect.facebook.net/en_US/fbevents.js")).toBe(false);
  });

  it("ships the expected metadata shape", () => {
    expect(meta.dsl).toEqual([]);
    expect(meta.seedVersion).toBe(1);
    expect(meta.name).toBe("Meta");
    expect(meta).not.toHaveProperty("source");
  });
});
