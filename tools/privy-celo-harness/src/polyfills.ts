import { Buffer as BufferPolyfill } from "buffer";

// `@privy-io/react-auth` reaches for Node's `Buffer` global on the embedded
// wallet crypto path. Vite does not polyfill Node globals in the browser (it
// externalizes `buffer` to a stub that throws on access), so both signing and
// sending failed with `ReferenceError: Buffer is not defined` — while every
// Celo-specific step (chain switch, fee estimate) worked.
//
// Import this module FIRST in the entry point, before anything pulls in Privy
// or wagmi. Guarded by src/__tests__/browser-globals.test.ts.
// See docs/validations/2026-07-24-privy-harness-smoke-diagnosis.md
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = BufferPolyfill;
}
