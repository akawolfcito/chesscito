"use client";

import { useTranslations } from "next-intl";

import { PrimaryPlayCta } from "@/components/kingdom/primary-play-cta";
import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { duelEndSummary } from "@/lib/duel/end-summary";
import { outcomeCopyKey } from "@/lib/duel/outcome-copy";
import type { DuelColor, DuelPublic } from "@/lib/duel/types";

/**
 * How a duel ends.
 *
 * ⛔ Built on `VictoryPopupShell` and NOT on `ArenaEndState`. That component
 * carries thirty-odd props about minting a victory, buying a Coach analysis,
 * share cards and persistence retries — the whole reward economy. A duel result
 * touches no Peones, no ranking and no badges, and the day it does the parent
 * spec stops being valid. Reusing it would drag the economy in one prop at a
 * time; the shell gives the same visual family with none of the promises.
 *
 * ⚠️ The tone comes from `duelEndTone`, which knows WHO is reading. Dressing a
 * loss as a celebration is the one failure this screen can commit.
 */

type Props = {
  duel: DuelPublic;
  you: DuelColor | null;
  onExit: () => void;
  onClose: () => void;
};

export function DuelEndOverlay({ duel, you, onExit, onClose }: Props) {
  const t = useTranslations("DUEL_COPY");
  const { tone, moves, elapsedMs } = duelEndSummary(duel, you);

  const title =
    tone === "win"
      ? t("endTitleWin")
      : tone === "loss"
        ? t("endTitleLoss")
        : tone === "draw"
          ? t("endTitleDraw")
          : t("endTitleNeutral");

  return (
    <VictoryPopupShell
      onClose={onClose}
      closeLabel={t("backToPlay")}
      ariaLabel={title}
      // ⚠️ `alert`, not `dialog`: the result is announced, not asked. And the
      // duel test that counts "one modal at a time" counts `aria-modal`, never
      // `role`, precisely because of overlays like this one.
      role="alert"
      ariaLive="polite"
      panelClassName={`duel-end duel-end--${tone}`}
    >
      <h2 className="duel-end-title">{title}</h2>
      <p className="duel-end-reason">{t(outcomeCopyKey(duel.outcome, you))}</p>

      <dl className="duel-end-stats">
        <div className="duel-end-stat">
          <dd>{t("endMoves", { count: moves })}</dd>
        </div>
        {elapsedMs === null ? null : (
          <div className="duel-end-stat">
            <dd>
              {t("endDuration", {
                minutes: Math.floor(elapsedMs / 60_000),
                seconds: Math.floor((elapsedMs % 60_000) / 1000),
              })}
            </dd>
          </div>
        )}
      </dl>

      {/* ⛔ One way out, and it is honest: back to the opponent picker, where a
          new duel is one tap away. There is no rematch — it is a non-goal of
          the spec, and a button that promised one would have nothing behind it. */}
      <PrimaryPlayCta
        surface="arena-entry"
        label={t("endNewDuel")}
        ariaLabel={t("endNewDuel")}
        onPress={onExit}
      />
    </VictoryPopupShell>
  );
}
