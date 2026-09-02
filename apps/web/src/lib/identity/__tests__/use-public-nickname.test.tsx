/**
 * ⛔ The one rule this hook exists to hold: the name a SECOND person reads is
 * the GENERATED nickname, never the custom override in localStorage.
 *
 * The custom-name test below is the whole point of the file. If somebody
 * "simplifies" the hook to `useDisplayName()`, that test is what falls — the
 * same guard `account-sheet-chesscito-id.test.tsx` already keeps for the chip.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import { usePublicNickname } from "@/lib/identity/use-public-nickname";
import {
  deriveAvatarVariant,
  formatNickname,
  type NicknameTokens,
} from "@/lib/identity/identity-lite";
import { nicknameTokensFromTranslator } from "@/lib/identity/nickname-tokens";

const ADDRESS = "0xAbCdEf0123456789AbCdEf0123456789AbCdEf01";

/**
 * ⚠️ Built through the real builder, not hand-rolled. A literal fixture has to
 * list every piece and style, so it goes stale the day one is added — and the
 * failure is a `TypeError` deep inside `formatNickname`, not a readable test.
 */
const tokens: NicknameTokens = nicknameTokensFromTranslator(
  Object.assign((key: string) => key.split(".").pop() ?? key, {
    raw: () => "{style} {piece} #{number}",
  }) as Parameters<typeof nicknameTokensFromTranslator>[0],
);

let connectedAddress: string | undefined = ADDRESS;

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: connectedAddress }),
}));

vi.mock("@/lib/identity/use-nickname-tokens", () => ({
  useNicknameTokens: () => tokens,
}));

beforeEach(() => {
  connectedAddress = ADDRESS;
  window.localStorage.clear();
});

describe("usePublicNickname", () => {
  it("derives the same nickname the leaderboard shows for this wallet", () => {
    const { result } = renderHook(() => usePublicNickname());

    expect(result.current).toBe(
      formatNickname(deriveAvatarVariant(ADDRESS.toLowerCase()), tokens),
    );
  });

  /** ⛔ The guard. A custom name in localStorage must change NOTHING here. */
  it("ignores a custom display name stored on this device", () => {
    window.localStorage.setItem(
      `chesscito:display-name:${ADDRESS.toLowerCase()}`,
      "Totally Custom",
    );

    const { result } = renderHook(() => usePublicNickname());

    expect(result.current).not.toBe("Totally Custom");
    expect(result.current).toBe(
      formatNickname(deriveAvatarVariant(ADDRESS.toLowerCase()), tokens),
    );
  });

  /** Case-insensitive: the same wallet must not get two identities. */
  it("does not depend on the casing of the address", () => {
    const { result: upper } = renderHook(() => usePublicNickname());
    connectedAddress = ADDRESS.toLowerCase();
    const { result: lower } = renderHook(() => usePublicNickname());

    expect(upper.current).toBe(lower.current);
  });

  /** ⚠️ A duel guest can reach the board before a wallet exists. */
  it("answers null when no wallet is connected", () => {
    connectedAddress = undefined;

    const { result } = renderHook(() => usePublicNickname());

    expect(result.current).toBeNull();
  });
});
