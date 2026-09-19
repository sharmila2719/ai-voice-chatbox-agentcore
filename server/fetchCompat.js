// fetchCompat.js — provide a `fetch` implementation across Node versions.
// Node 18+ has global fetch. On Node 16/17 we fall back to node-fetch.
// Exports an async getFetch() so the import stays lazy and non-fatal.

let cached = null;

export async function getFetch() {
  if (cached) return cached;
  if (typeof globalThis.fetch === "function") {
    cached = globalThis.fetch.bind(globalThis);
    return cached;
  }
  try {
    const mod = await import("node-fetch");
    cached = mod.default;
    return cached;
  } catch {
    throw new Error(
      "This Node version has no global fetch. Install a fallback with: npm install node-fetch  (or upgrade to Node 18+)."
    );
  }
}
