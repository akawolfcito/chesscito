"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import {
  CLOCK_LADDER_MINUTES,
  DEFAULT_CLOCK_MINUTES,
  clockStep,
  type ClockMinutes,
} from "@/lib/duel/clock";
import { createDuelRequest } from "@/lib/duel/api";
import { PrimaryPlayCta } from "@/components/kingdom/primary-play-cta";
import { useThemeBackground } from "@/lib/themes/use-theme-background";
import { storeSeatToken } from "@/lib/duel/seat-store";

/**
 * Choosing the clock, and only then creating the duel.
 *
 * ⛔ The ladder IS the validation: seven values, two buttons, nothing to type,
 * ask for an absurd amount of time. â ï¸ Its FLOOR is 3 minutes since the first
 * playtest: below that, the seconds lost between the join and the first sight
 * of the board are a visible slice of the game. See `clock.ts`.
 *
 * ⚠️ The clock is picked BEFORE the link exists (founder, 2026-08-15), and that
 * is not a layout preference: once the duel is created the time is immutable in
 * the row, so the guest sees the rules already fixed and nobody can change them
 * after the link has been read.
 */

type Props = {
  displayName?: string | null;
  sessionId?: string | null;
  /** Handed the duel id once the server has it. */
  onCreated: (duelId: string) => void;
  onCancel: () => void;
};

export function DuelSetupSheet({ displayName, sessionId, onCreated, onCancel }: Props) {
  const t = useTranslations("DUEL_COPY");
  const [minutes, setMinutes] = useState<ClockMinutes>(DEFAULT_CLOCK_MINUTES);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  /** â ï¸ El mismo fondo de panel que ya usan PromotionOverlay y VictoryPopupShell.
   *  Inventar un gradiente propio fue el error de la primera version: el jugador
   *  lee las hojas del juego como una familia, y una que no lo es se nota. */
  const panelBackground = useThemeBackground("shared.panel-bg");

  const step = useCallback(
    (direction: -1 | 1) => setMinutes((current) => clockStep(current, direction)),
    [],
  );

  const create = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const result = await createDuelRequest({ minutes, displayName, sessionId });
    setBusy(false);

    if (!result.ok) {
      setFailed(true);
      return;
    }
    // ⚠️ Parked BEFORE navigating. The seat credential is the only thing that
    // will ever authorize a move in this duel, and the navigation that follows
    // must not be able to race the write.
    if (result.seatToken) storeSeatToken(result.duel.id, result.seatToken);
    onCreated(result.duel.id);
  }, [busy, displayName, minutes, onCreated, sessionId]);

  const atFloor = minutes === CLOCK_LADDER_MINUTES[0];
  const atCeiling = minutes === CLOCK_LADDER_MINUTES[CLOCK_LADDER_MINUTES.length - 1];

  return (
    <div className="duel-setup" role="dialog" aria-modal="true" aria-label={t("setupTitle")}>
      <div className="duel-setup-panel" style={{ backgroundImage: panelBackground }}>
        <h2 className="duel-title">{t("setupTitle")}</h2>

        <p className="duel-hint">{t("setupClockLabel")}</p>
        <div className="duel-ladder">
          <button
            type="button"
            className="duel-ladder-step"
            aria-label={t("setupLess")}
            disabled={atFloor || busy}
            onClick={() => step(-1)}
          >
            −
          </button>
          <span className="duel-ladder-value" aria-live="polite">
            {t("setupMinutes", { count: minutes })}
          </span>
          <button
            type="button"
            className="duel-ladder-step"
            aria-label={t("setupMore")}
            disabled={atCeiling || busy}
            onClick={() => step(1)}
          >
            +
          </button>
        </div>

        {failed ? (
          <p className="duel-notice" role="alert">
            {t("noticeUnavailable")}
          </p>
        ) : null}

        <PrimaryPlayCta surface="arena-entry" label={busy ? t("setupCreating") : t("setupCreate")} ariaLabel={t("setupCreate")} loading={busy} onPress={() => void create()} />
        <button type="button" className="duel-secondary" onClick={onCancel} disabled={busy}>
          {t("setupCancel")}
        </button>
      </div>
    </div>
  );
}
