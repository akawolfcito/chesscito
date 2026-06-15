"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ArenaConfirmModal } from "@/components/arena/arena-confirm-modal";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { PlayerAvatar } from "@/components/redesign/player-avatar";
import { WoodenBanner } from "@/components/redesign/wooden-banner";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { formatTime } from "@/lib/game/arena-utils";
import { useIsProActive } from "@/lib/pro/use-is-pro-active";
import { useShieldsCount } from "@/lib/shop/use-shields-count";

type Props = {
  isThinking: boolean;
  onBack: () => void;
  isEndState?: boolean;
  elapsedMs: number;
  /** When true (and the game is not yet in end-state), render the
   *  in-match Coach signpost beneath the matchup row. Gated by
   *  NEXT_PUBLIC_ENABLE_COACH at the call site (arena/page.tsx). */
  showCoachHint?: boolean;
  /** Optional slot rendered DIRECTLY under the central VS banner, in
   *  the same flex column as the wooden plate. Used to anchor the
   *  difficulty selector pill so it visually anchors the matchup
   *  axis rather than floating below the avatar row. */
  vsBelowSlot?: ReactNode;
};

/** Back chip in the canonical `candy-nav-button` envelope. During an
 *  active match, tapping it opens a clear "leave the match?" modal
 *  (VictoryPopupShell vocabulary) instead of the old inline 3s-countdown
 *  QUIT? affordance (2026-06-15). On end-state (needsConfirm=false) it
 *  fires onBack immediately. */
function ArenaBackChip({
  onBack,
  needsConfirm,
}: {
  onBack: () => void;
  needsConfirm: boolean;
}) {
  const t = useTranslations("ARENA_COPY");
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleClick() {
    if (!needsConfirm) {
      onBack();
      return;
    }
    setConfirmOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={t("backToHubAria")}
        className="candy-nav-button"
      >
        <CandyBanner name="btn-back" className="h-8 w-8" />
      </button>
      <ArenaConfirmModal
        open={confirmOpen}
        title={t("quitModalTitle")}
        body={t("quitModalBody")}
        confirmLabel={t("quitModalConfirm")}
        cancelLabel={t("quitModalCancel")}
        closeAriaLabel={t("confirmModalCloseAria")}
        confirmTestId="arena-quit-confirm"
        onConfirm={() => {
          setConfirmOpen(false);
          onBack();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

/* Live match timer + inline shield count — reuses the HUD chip family
 * from the Hub (candy-tray-pill + hub-hud-pill + --anchored-left) so
 * the chip reads as a sibling of the trophy / connect pills. When the
 * wallet has shields available, an inline divider + shield count
 * appears beside the timer (consistent with the exercises HUD's
 * stars+shields combined pill — same visual vocabulary across the
 * app). When shields == 0 the chip renders as the legacy timer-only
 * pill (no divider). */
function ArenaTimerChip({
  elapsedMs,
  isEndState,
}: {
  elapsedMs: number;
  isEndState?: boolean;
}) {
  const t = useTranslations("ARENA_COPY");
  const value = formatTime(elapsedMs);
  const shieldsCount = useShieldsCount();
  // Shields suppressed on end-state so the closing UI stays clean
  // (preserves the rule from the pre-combined separate-row design).
  const showShields = shieldsCount > 0 && !isEndState;
  return (
    <span
      className="candy-tray-pill hub-hud-pill hub-hud-pill--anchored-left"
      role="status"
      aria-live="polite"
      aria-label={
        showShields
          ? `${t("timerAriaLabel", { time: value })} · ${shieldsCount} shields`
          : t("timerAriaLabel", { time: value })
      }
    >
      <CandyIcon name="time" className="candy-tray-pill-icon candy-tray-pill-icon--floating" />
      <span className="arena-timer-chip-value">{value}</span>
      {showShields ? (
        <>
          <span
            aria-hidden="true"
            className="candy-tray-pill-divider"
          />
          {/* Inline shield sprite — must NOT use candy-tray-pill-icon
           *  --floating because that class is positioned absolute
           *  inside a hub-hud-pill (left: -1.3rem) and would stack
           *  on top of the time icon. The arena-timer-chip-inline-
           *  icon class below renders inline at 1.4rem so the chip
           *  reads "clock 0:25 | shield 7" left-to-right. */}
          <picture
            aria-hidden="true"
            className="arena-timer-chip-inline-icon"
          >
            <source srcSet="/art/redesign/icons/shield.avif" type="image/avif" />
            <source srcSet="/art/redesign/icons/shield.webp" type="image/webp" />
            <img
              src="/art/redesign/icons/shield.png"
              alt=""
              aria-hidden="true"
              draggable={false}
            />
          </picture>
          <span className="tabular-nums text-sm font-extrabold">
            {shieldsCount}
          </span>
        </>
      ) : null}
    </span>
  );
}

/* Shields-available chip — point-of-use callout for Phase 2 shop
 * oscuridad (handoff 2026-05-30 §1). Renders only when count > 0 and
 * the match is in-play; suppressed in end-state so the closing UI
 * doesn't compete. Reuses the canonical candy-tray-pill family + the
 * HUD_COPY shields* keys already provisioned for the hub HUD.
 *
 * Exported (2026-05-30) so the /dev/arena-shields-chip fixture can
 * mount this slice in isolation without pulling the full ArenaHud +
 * wagmi tree into the VR harness. */
export function ArenaShieldsChip() {
  const t = useTranslations("HUD_COPY");
  const count = useShieldsCount();
  if (count <= 0) return null;
  return (
    <span
      className="candy-tray-pill hub-hud-pill hub-hud-pill--anchored-left"
      role="status"
      aria-label={t("shieldsAriaLabel", { count })}
    >
      <CandyIcon
        name="shield"
        className="candy-tray-pill-icon candy-tray-pill-icon--floating"
      />
      <span className="arena-timer-chip-value">
        {t("shieldsFormat", { count })}
      </span>
    </span>
  );
}

export function ArenaHud({
  isThinking,
  onBack,
  isEndState,
  elapsedMs,
  vsBelowSlot,
}: Props) {
  const t = useTranslations("ARENA_COPY");
  const needsBackConfirm = !isEndState;
  const isProActive = useIsProActive();

  return (
    <div className="arena-hud flex flex-col gap-4">
      {/* Header — canonical <ContextualHeader back-control> envelope
       *  (52–64 px). The bespoke QUIT?-state back chip lives in the
       *  `backSlot` override; the live timer occupies the trailing
       *  slot.
       *  Divider DROPPED on purpose (Sally pass 8, 2026-05-20):
       *  /arena match is a diegetic gameplay surface. The matchup
       *  avatars + board are the screen; the divider would compete
       *  visually with the You-vs-Bot row immediately below. */}
      <div>
        <ContextualHeader
          variant="back-control"
          title={t("title")}
          backSlot={
            <ArenaBackChip onBack={onBack} needsConfirm={needsBackConfirm} />
          }
          trailingControl={
            <ArenaTimerChip elapsedMs={elapsedMs} isEndState={isEndState} />
          }
        />
      </div>

      {/* Shields chip standalone row removed 2026-05-31: shield count
       *  now lives INSIDE the timer pill (see ArenaTimerChip). One
       *  combined chip matches the /exercises HUD pattern and removes
       *  the dedicated row that pushed the matchup below the fold on
       *  smaller viewports. ArenaShieldsChip export preserved for the
       *  /dev/arena-shields-chip fixture. */}

      {/* Row 2: Matchup art (Heads) — Symmetric Battle Header */}
      <div className="arena-hud-matchup relative flex items-center justify-between px-2 pt-2">
        <div className="flex flex-1 justify-center">
          <PlayerAvatar
            variant="you"
            pro={isProActive}
            className="h-24 w-24 drop-shadow-xl"
          />
        </div>

        <div className="flex shrink-0 flex-col items-center justify-center gap-2">
          <WoodenBanner variant="vs" className="scale-90 drop-shadow-lg" />
          {vsBelowSlot}
        </div>

        <div className="relative flex flex-1 justify-center">
          <PlayerAvatar
            variant="bot"
            pro={isProActive}
            className="h-24 w-24 drop-shadow-xl"
          />
          {isThinking && (
            <span className="pointer-events-none absolute -top-2 -right-2 flex h-8 w-12">
              <LottieAnimation
                src="/animations/sandy-loading.lottie"
                loop
                className="h-full w-full"
              />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
