"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { DuelArena } from "@/components/duel/duel-arena";
import { getAnonymousId } from "@/lib/analytics/identity";

/**
 * Everything the duel needs from the framework, in one small file.
 *
 * ⚠️ It exists so `arena/page.tsx` gains three lines instead of thirty. That
 * page is 1655 lines of the AI match and its hooks are spread through all of
 * them, so the duel cannot branch INSIDE it without breaking the rules of
 * hooks. Branching above it means the AI tree never mounts for a duel at all.
 */
export function DuelArenaRoute({ duelId }: { duelId: string }) {
  const locale = useLocale();
  const router = useRouter();

  const onExit = useCallback(() => {
    // Back to the opponent picker, not to the duel we just left: the `?duel=`
    // would put us straight back where we were.
    router.push(`/${locale}/arena`);
  }, [locale, router]);

  return (
    <DuelArena
      duelId={duelId}
      locale={locale}
      // ⛔ The visit id the client already owns, the same one every other event
      // in this app carries. Minting a synthetic one per duel would land these
      // rows in the table the `stats_*` RPCs read and inflate `events/session`
      // and the session counts on the public `/stats` page.
      sessionId={getAnonymousId()}
      onExit={onExit}
    />
  );
}
