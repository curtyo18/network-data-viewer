import { describe, it, expect } from "vitest";
import { meta } from "@/examples/contentsquare.meta";

describe("contentsquare meta", () => {
  const re = new RegExp(meta.urlPattern);

  it("matches the analytics endpoints on c.contentsquare.net", () => {
    expect(re.test("https://c.contentsquare.net/pageview?pid=2887&uu=abc&pn=1")).toBe(true);
    expect(re.test("https://c.contentsquare.net/events?pid=2887")).toBe(true);
    expect(re.test("https://c.contentsquare.net/transaction?pid=2887")).toBe(true);
    expect(re.test("https://c.contentsquare.net/dvar?pid=2887")).toBe(true);
    expect(re.test("https://c.contentsquare.net/pageEvent?value=xyz")).toBe(true);
    // Bare-apex (no subdomain) is permitted per research doc §1.4
    expect(re.test("https://contentsquare.net/pageview?pid=2887")).toBe(true);
    // Fragment anchor branch
    expect(re.test("https://c.contentsquare.net/pageview#frag")).toBe(true);
  });

  it("matches the error and display endpoints", () => {
    expect(re.test("https://c.contentsquare.net/display")).toBe(true);
    expect(re.test("https://c.contentsquare.net/errors")).toBe(true);
    expect(re.test("https://c.contentsquare.net/custom-errors")).toBe(true);
    expect(re.test("https://c.contentsquare.net/api-errors")).toBe(true);
  });

  it("matches the recording endpoints across regions and apiVersions", () => {
    expect(re.test("https://k-aeu1.contentsquare.net/v2/recording")).toBe(true);
    expect(re.test("https://k-aus1.contentsquare.net/v2/recording")).toBe(true);
    expect(re.test("https://k.eu1.az.contentsquare.net/v2/recording")).toBe(true);
    expect(re.test("https://k.ba.contentsquare.net/v1/recording")).toBe(true);
    // Forward-compat for future apiVersion bumps:
    expect(re.test("https://k-aeu1.contentsquare.net/v3/recording")).toBe(true);
  });

  it("matches the quota and srm endpoints", () => {
    expect(re.test("https://k-aeu1.contentsquare.net/quota")).toBe(true);
    expect(re.test("https://q-aus1.contentsquare.net/quota")).toBe(true);
    expect(re.test("https://srm.aa.contentsquare.net/exist")).toBe(true);
    expect(re.test("https://srm.bf.contentsquare.net/putTag")).toBe(true);
  });

  it("does NOT match the tag-script host or platform UI", () => {
    expect(re.test("https://t.contentsquare.net/uxa/2887.js")).toBe(false);
    expect(re.test("https://app.contentsquare.com/sites/2887")).toBe(false);
  });

  it("does NOT match unrelated subpaths on contentsquare.net", () => {
    expect(re.test("https://c.contentsquare.net/health-check")).toBe(false);
  });

  it("ships the expected metadata shape", () => {
    expect(meta.dsl).toEqual([]);
    expect(meta.seedVersion).toBe(2);
    expect(meta).not.toHaveProperty("source");
  });
});
