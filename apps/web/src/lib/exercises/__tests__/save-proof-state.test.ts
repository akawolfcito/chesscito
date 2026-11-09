import { describe, expect, it } from "vitest";
import {
  canSaveOnChain,
  hasOnchainProof,
  type SaveProofInputs,
} from "../save-proof-state";

/** Wallet connected, on Celo, scoreboard configured, one star earned,
 *  score 120 pending — the shape right after a new personal best. */
const PENDING: SaveProofInputs = {
  canSaveScore: true,
  hasScoreboard: true,
  totalStars: 1,
  localScore: 120,
  lastSavedScore: 0,
  lastSavedTxHash: null,
};

/** After the B2 silent auto-save resolves: score is persisted off-chain
 *  (recordSaveFor writes an EMPTY txHash) so parity is reached but no
 *  on-chain proof exists. This is the P1 regression case. */
const SAVED_OFFCHAIN: SaveProofInputs = {
  ...PENDING,
  lastSavedScore: 120,
  lastSavedTxHash: "",
};

/** After `submitScoreSigned` confirms: parity + a real receipt hash. */
const PROVEN_ONCHAIN: SaveProofInputs = {
  ...PENDING,
  lastSavedScore: 120,
  lastSavedTxHash: "0xabc123",
};

describe("hasOnchainProof", () => {
  it("is false before any save", () => {
    expect(hasOnchainProof(PENDING)).toBe(false);
  });

  it("is false after an off-chain save (empty txHash is not a receipt)", () => {
    expect(hasOnchainProof(SAVED_OFFCHAIN)).toBe(false);
  });

  it("is true once a real tx hash covers the current score", () => {
    expect(hasOnchainProof(PROVEN_ONCHAIN)).toBe(true);
  });

  it("is false when the proven score is stale (player improved since)", () => {
    expect(
      hasOnchainProof({ ...PROVEN_ONCHAIN, localScore: 150 }),
    ).toBe(false);
  });

  it("is true when the proven score exceeds the current one", () => {
    // Defensive: a lower local score must not re-arm the CTA. Can happen
    // if progress is reset locally while the save state survives.
    expect(
      hasOnchainProof({ ...PROVEN_ONCHAIN, localScore: 90 }),
    ).toBe(true);
  });
});

describe("canSaveOnChain", () => {
  it("shows the proof CTA for a brand-new pending score", () => {
    expect(canSaveOnChain(PENDING)).toBe(true);
  });

  it("KEEPS showing the proof CTA after the off-chain auto-save lands", () => {
    // P1 regression guard: B2's auto-save reaches parity and used to
    // close `scorePendingNew`, which silently hid the golden CTA.
    expect(canSaveOnChain(SAVED_OFFCHAIN)).toBe(true);
  });

  it("hides the proof CTA once the score is proven on-chain", () => {
    expect(canSaveOnChain(PROVEN_ONCHAIN)).toBe(false);
  });

  it("re-arms the proof CTA when the player beats a proven score", () => {
    expect(canSaveOnChain({ ...PROVEN_ONCHAIN, localScore: 150 })).toBe(true);
  });

  it("hides the CTA when no scoreboard is deployed (fail-closed, no dead CTA)", () => {
    expect(canSaveOnChain({ ...PENDING, hasScoreboard: false })).toBe(false);
  });

  it("hides the CTA when the wallet preconditions are unmet", () => {
    // canSaveScore folds address + isConnected + isCorrectChain + levelId.
    expect(canSaveOnChain({ ...PENDING, canSaveScore: false })).toBe(false);
    expect(canSaveOnChain({ ...SAVED_OFFCHAIN, canSaveScore: false })).toBe(false);
  });

  it("hides the CTA before the first star is earned", () => {
    expect(canSaveOnChain({ ...PENDING, totalStars: 0 })).toBe(false);
  });

  it("hides the CTA when there is no score to prove", () => {
    expect(
      canSaveOnChain({ ...PENDING, totalStars: 1, localScore: 0 }),
    ).toBe(false);
  });
});
