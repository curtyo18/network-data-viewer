// Captures image-beacon requests — tracking pixels (Meta's fbevents.js, Google
// Ads conversion pixels, Pinterest, …) fire GET beacons by assigning to an
// Image's `src` rather than via fetch/XHR/sendBeacon, so they bypass those
// patches. We hook the prototype `src` setter to observe the URL.
//
// Extracted from the content script so the safety-critical invariants — never
// throw into page code, always run the native setter, preserve the getter,
// forward the raw value — are unit-testable.

const SEEN_CAP = 1000;

/**
 * Patch an HTMLImageElement-like prototype's `src` setter so each new http(s)
 * URL is reported via `emit`. Lossless URL dedup suppresses the dominant volume
 * source (lazy-load swaps, re-renders, and carousels re-setting identical srcs)
 * without dropping any distinct beacon — real pixel URLs differ per fire.
 *
 * @param proto    the prototype carrying the `src` accessor (HTMLImageElement.prototype)
 * @param emit     called with the resolved absolute URL of each new beacon
 * @param baseURI  base for resolving relative values (document.baseURI)
 */
export function installImageCapture(
  proto: object,
  emit: (url: string) => void,
  baseURI: string,
): void {
  const desc = Object.getOwnPropertyDescriptor(proto, "src");
  if (!desc || typeof desc.set !== "function") return;
  const origSrcSet = desc.set;
  const seen = new Set<string>();

  Object.defineProperty(proto, "src", {
    // Spread the original descriptor so the native GETTER (and enumerable/
    // configurable) are preserved — reads of `img.src` still work.
    ...desc,
    set(this: object, value: string) {
      try {
        const raw = String(value);
        // An empty/whitespace src resolves to the document URL — a reset, not a
        // beacon. Skip it so we don't emit the page's own URL on every clear.
        if (raw.trim() !== "") {
          const url = new URL(raw, baseURI).href;
          if (/^https?:/i.test(url) && !seen.has(url)) {
            if (seen.size >= SEEN_CAP) seen.clear();
            seen.add(url);
            emit(url);
          }
        }
      } catch {
        /* relative/invalid/empty src, or a throwing toString — never throw into the page */
      }
      // Forward the RAW `value` (not the coerced string) so a TrustedURL wrapper
      // survives to the native setter. Outside the try so the page's assignment
      // ALWAYS completes, even if the emit above failed.
      origSrcSet.call(this, value);
    },
  });
}
