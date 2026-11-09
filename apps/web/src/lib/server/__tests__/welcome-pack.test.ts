import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import {
  buildClaimMessage,
  hashIp,
  hashUserAgent,
  validateClaimInput,
  WELCOME_PACK_REPLAY_WINDOW_MS,
  WELCOME_PACK_SHIELDS,
} from "../welcome-pack";

const NOW_ISO = "2026-05-31T12:00:00.000Z";
const NOW_MS = Date.parse(NOW_ISO);

function freshAccount() {
  return privateKeyToAccount(generatePrivateKey());
}

async function signedPayload(opts: {
  timestamp?: string;
  overrideMessageAddress?: string;
}) {
  const account = freshAccount();
  const timestamp = opts.timestamp ?? NOW_ISO;
  const messageAddress = opts.overrideMessageAddress ?? account.address;
  const message = buildClaimMessage(messageAddress, timestamp);
  const signature = await account.signMessage({ message });
  return { account, message, signature };
}

describe("WELCOME_PACK_SHIELDS", () => {
  it("is exactly 3 (spec §4.3 — pack contents)", () => {
    expect(WELCOME_PACK_SHIELDS).toBe(3);
  });
});

describe("buildClaimMessage", () => {
  it("produces the canonical signed-message format", () => {
    const msg = buildClaimMessage("0xabc", NOW_ISO);
    expect(msg).toBe(`Chesscito Welcome Pack — claim for 0xabc at ${NOW_ISO}`);
  });
});

describe("validateClaimInput", () => {
  it("returns ok=true for a fresh signed payload", async () => {
    const { account, message, signature } = await signedPayload({});
    const result = await validateClaimInput(
      { address: account.address, signature, message },
      NOW_MS,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.address).toBe(account.address);
  });

  it("rejects when address is not a valid 0x address", async () => {
    const { message, signature } = await signedPayload({});
    const result = await validateClaimInput(
      { address: "not-an-address", signature, message },
      NOW_MS,
    );
    expect(result).toEqual({ ok: false, error: "invalid_address" });
  });

  it("rejects when message does not match the canonical format", async () => {
    const account = freshAccount();
    const message = `Some other message`;
    const signature = await account.signMessage({ message });
    const result = await validateClaimInput(
      { address: account.address, signature, message },
      NOW_MS,
    );
    expect(result).toEqual({ ok: false, error: "invalid_message" });
  });

  it("rejects when message address ≠ body address (cross-account forgery attempt)", async () => {
    const realAccount = freshAccount();
    const otherAccount = freshAccount();
    // Sign a message whose embedded address is otherAccount, but submit
    // as realAccount in the body. Should fail invalid_message.
    const message = buildClaimMessage(otherAccount.address, NOW_ISO);
    const signature = await realAccount.signMessage({ message });
    const result = await validateClaimInput(
      { address: realAccount.address, signature, message },
      NOW_MS,
    );
    expect(result).toEqual({ ok: false, error: "invalid_message" });
  });

  it("accepts when message address differs only in casing from body address", async () => {
    const account = freshAccount();
    const message = buildClaimMessage(
      account.address.toLowerCase(),
      NOW_ISO,
    );
    const signature = await account.signMessage({ message });
    const result = await validateClaimInput(
      { address: account.address, signature, message },
      NOW_MS,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects when timestamp is older than the replay window", async () => {
    const staleIso = new Date(
      NOW_MS - WELCOME_PACK_REPLAY_WINDOW_MS - 1000,
    ).toISOString();
    const { account, message, signature } = await signedPayload({
      timestamp: staleIso,
    });
    const result = await validateClaimInput(
      { address: account.address, signature, message },
      NOW_MS,
    );
    expect(result).toEqual({ ok: false, error: "stale_request" });
  });

  it("rejects when timestamp is too far in the future", async () => {
    const futureIso = new Date(
      NOW_MS + WELCOME_PACK_REPLAY_WINDOW_MS + 1000,
    ).toISOString();
    const { account, message, signature } = await signedPayload({
      timestamp: futureIso,
    });
    const result = await validateClaimInput(
      { address: account.address, signature, message },
      NOW_MS,
    );
    expect(result).toEqual({ ok: false, error: "stale_request" });
  });

  it("accepts boundary timestamps inside the ±5min window", async () => {
    const justInside = new Date(
      NOW_MS - WELCOME_PACK_REPLAY_WINDOW_MS + 1,
    ).toISOString();
    const { account, message, signature } = await signedPayload({
      timestamp: justInside,
    });
    const result = await validateClaimInput(
      { address: account.address, signature, message },
      NOW_MS,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects when signature was produced by a different private key", async () => {
    const claimer = freshAccount();
    const attacker = freshAccount();
    const message = buildClaimMessage(claimer.address, NOW_ISO);
    // attacker signs claimer's message — recovery will return attacker.
    const signature = await attacker.signMessage({ message });
    const result = await validateClaimInput(
      { address: claimer.address, signature, message },
      NOW_MS,
    );
    expect(result).toEqual({ ok: false, error: "signature_mismatch" });
  });

  it("rejects when signature is malformed garbage", async () => {
    const { account, message } = await signedPayload({});
    const result = await validateClaimInput(
      {
        address: account.address,
        signature: "0xdeadbeef",
        message,
      },
      NOW_MS,
    );
    expect(result).toEqual({ ok: false, error: "signature_mismatch" });
  });
});

describe("hashIp", () => {
  const SAVED_SALT = process.env.CLAIM_IP_HASH_SALT;

  beforeEach(() => {
    process.env.CLAIM_IP_HASH_SALT = "test-salt";
  });

  afterEach(() => {
    if (SAVED_SALT === undefined) delete process.env.CLAIM_IP_HASH_SALT;
    else process.env.CLAIM_IP_HASH_SALT = SAVED_SALT;
  });

  it("returns a deterministic SHA-256 hex string for the same input", () => {
    const a = hashIp("1.2.3.4");
    const b = hashIp("1.2.3.4");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns different hashes for different IPs (under same salt)", () => {
    expect(hashIp("1.2.3.4")).not.toBe(hashIp("5.6.7.8"));
  });

  it("returns different hashes when the salt changes", () => {
    const a = hashIp("1.2.3.4");
    process.env.CLAIM_IP_HASH_SALT = "different-salt";
    const b = hashIp("1.2.3.4");
    expect(a).not.toBe(b);
  });

  it("returns null when salt env is missing (prevents rainbow tables)", () => {
    delete process.env.CLAIM_IP_HASH_SALT;
    expect(hashIp("1.2.3.4")).toBeNull();
  });

  it("returns null when IP is 'unknown' (no usable identity)", () => {
    expect(hashIp("unknown")).toBeNull();
  });
});

describe("hashUserAgent", () => {
  it("returns a hex digest for a non-null UA", () => {
    const hash = hashUserAgent("Mozilla/5.0 (test)");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns null for a null UA", () => {
    expect(hashUserAgent(null)).toBeNull();
  });

  it("is stable across calls (no salt — UA hash is purely for grouping)", () => {
    expect(hashUserAgent("Mozilla/5.0")).toBe(hashUserAgent("Mozilla/5.0"));
  });
});
