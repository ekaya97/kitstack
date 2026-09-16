/**
 * Public memory surface for the debrief kit.
 *
 * `policy.ts` contains kit-owned retrieval/teaching semantics. `plugin.ts`
 * contains the default persistence-backed implementation used by the local
 * host and demo. Keeping both behind this barrel makes the distinction
 * explicit without splitting one capability across unrelated directories.
 */
export * from "./policy.js";
export * from "./plugin.js";
