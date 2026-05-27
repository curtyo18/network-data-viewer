import { describe, it, expect } from "vitest";
import { meta } from "@/examples/ga4.meta";

describe("ga4 meta", () => {
  const re = new RegExp(meta.urlPattern);

  it("matches the canonical GA4 collect endpoints", () => {
    expect(re.test("https://www.google-analytics.com/g/collect?v=2&tid=G-X")).toBe(true);
    expect(re.test("https://www.google-analytics.com/j/collect?v=2")).toBe(true);
    expect(re.test("https://www.google-analytics.com/r/collect?v=2")).toBe(true);
    expect(re.test("https://www.google-analytics.com/collect?v=1")).toBe(true);
    // Fragment anchor: gtag never sets one but the regex alternation allows it,
    // so lock the behaviour in.
    expect(re.test("https://www.google-analytics.com/g/collect#frag")).toBe(true);
  });

  it("matches the regional EU endpoints", () => {
    expect(re.test("https://region1.google-analytics.com/g/collect?v=2")).toBe(true);
    expect(re.test("https://region1.analytics.google.com/g/collect?v=2")).toBe(true);
    expect(re.test("https://region7.google-analytics.com/g/collect?v=2")).toBe(true);
  });

  it("matches the DoubleClick / Signals endpoints", () => {
    expect(re.test("https://stats.g.doubleclick.net/g/collect?v=2&aip=1")).toBe(true);
  });

  it("matches server-side GTM proxies on customer domains", () => {
    expect(re.test("https://sgtm.example.com/g/collect?v=2")).toBe(true);
    expect(re.test("https://analytics.shop.example.com/g/collect")).toBe(true);
  });

  it("does NOT match the GTM/gtag config loader", () => {
    expect(re.test("https://www.googletagmanager.com/gtag/js?id=G-X")).toBe(false);
    expect(re.test("https://www.googletagmanager.com/gtm.js?id=GTM-X")).toBe(false);
  });

  it("does NOT match Google Ads endpoints", () => {
    expect(re.test("https://www.google.com/pagead/1p-conversion/123")).toBe(false);
    expect(re.test("https://googleadservices.com/pagead/conversion/123")).toBe(false);
    expect(re.test("https://www.google.com/ccm/collect")).toBe(false);
  });

  it("does NOT match server-side measurement protocol", () => {
    expect(re.test("https://www.google-analytics.com/mp/collect?api_secret=x")).toBe(false);
  });

  it("ships the expected metadata shape", () => {
    expect(meta.dsl).toEqual([]);
    expect(meta.seedVersion).toBe(2);
    expect(meta).not.toHaveProperty("source");
  });
});
