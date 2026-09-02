"use client";

import { useAccount } from "wagmi";

import { deriveAvatarVariant, formatNickname } from "./identity-lite";
import { useNicknameTokens } from "./use-nickname-tokens";

/**
 * The name OTHER PEOPLE read for this player.
 *
 * ⛔ This is the generated nickname — the same one the leaderboard, the Hall of
 * Fame and the Chesscito ID chip render for this wallet. It is deliberately NOT
 * `useDisplayName()`: that one resolves `custom > generated`, and the custom
 * override is written to `localStorage` under `chesscito:display-name:<address>`
 * and NEVER travels to the server. A surface that shows it names the player
 * something nobody else can see — it looks right on their screen and lies about
 * what everyone else reads.
 *
 * So the rule, which until now lived as a comment repeated at each call site
 * (`account-sheet.tsx:92`, `leaderboard-sheet.tsx:329`, `trophy-card.tsx:50`),
 * has one home: **any surface where a SECOND person reads your name derives it
 * here.**
 *
 * ⚠️ Returns `null` when there is no connected wallet, and that is a real state
 * — a duel guest can reach the board before a wallet exists. Callers must treat
 * null as "anonymous" and fall back to their own copy, never to an empty string:
 * an empty name renders as a blank ribbon, which reads as a bug.
 */
export function usePublicNickname(): string | null {
  const { address } = useAccount();
  const tokens = useNicknameTokens();

  if (!address) return null;

  return formatNickname(deriveAvatarVariant(address.toLowerCase()), tokens);
}
