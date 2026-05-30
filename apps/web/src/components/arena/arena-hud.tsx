"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

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

const CONFIRM_TIMEOUT_MS = 3000;

/** Back chip with a tap-to-confirm QUIT? state. Styled with the
 *  canonical `candy-nav-button` envelope so it matches every other
 *  back affordance in the app — the previous arena-themed
 *  green-gradient + yellow-border skin felt inconsistent (user
 *  feedback Sally pass 7, 2026-05-20). The QUIT? interaction (3-second
 *  countdown before second tap confirms) is preserved. */
function ArenaBackChip({
  onBack,
  needsConfirm,
}: {
  onBack: () => void;
  needsConfirm: boolean;
}) {
  const t = useTranslations("ARENA_COPY");
  const [confirmingBack, setConfirmingBack] = useState(false);
  const backTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (backTimerRef.current) clearTimeout(backTimerRef.current);
    };
  }, []);

  function handleClick() {
    if (!needsConfirm) {
      onBack();
      return;
    }
    if (confirmingBack) {
      if (backTimerRef.current) clearTimeout(backTimerRef.current);
      setConfirmingBack(false);
      onBack();
    } else {
      setConfirmingBack(true);
      backTimerRef.current = setTimeout(
        () => setConfirmingBack(false),
        CONFIRM_TIMEOUT_MS,
      );
    }
  }

  if (confirmingBack) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={t("confirmQuitAriaLabel")}
        className="candy-nav-button relative w-auto px-3 overflow-hidden"
      >
        <span className="flex items-center gap-1.5 whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
          <CandyIcon
            name="close"
            className="h-4 w-4"
            style={{ color: "rgba(159, 18, 57, 0.95)" }}
          />
          <span
            className="text-[0.7rem] font-black uppercase tracking-[0.15em]"
            style={{ color: "rgba(159, 18, 57, 0.95)" }}
          >
            {t("confirmQuitLabel")}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-1 w-full origin-left"
          style={{
            background: "rgba(159, 18, 57, 0.40)",
            animation: `confirm-countdown ${CONFIRM_TIMEOUT_MS}ms linear forwards`,
          }}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={t("backToHubAria")}
      className="candy-nav-button"
    >
      <CandyBanner name="btn-back" className="h-8 w-8" />
    </button>
  );
}

/* Live match timer — reuses the HUD chip family from the Hub
 * (candy-tray-pill + hub-hud-pill + --anchored-left) so the timer
 * reads as a sibling of the trophy / connect chips: cream-amber
 * pill, warm-brown outline, oversized icon floating off the leading
 * edge, squared-off left corners tucked behind the icon. The icon
 * stays `CandyIcon name="time"`; the value span carries the
 * monospace + tabular-nums so per-second ticks don't jitter the
 * pill width. */
function ArenaTimerChip({ elapsedMs }: { elapsedMs: number }) {
  const t = useTranslations("ARENA_COPY");
  const value = formatTime(elapsedMs);
  return (
    <span
      className="candy-tray-pill hub-hud-pill hub-hud-pill--anchored-left"
      role="status"
      aria-live="polite"
      aria-label={t("timerAriaLabel", { time: value })}
    >
      <CandyIcon name="time" className="candy-tray-pill-icon candy-tray-pill-icon--floating" />
      <span className="arena-timer-chip-value">{value}</span>
    </span>
  );
}

/* Shields-available chip — point-of-use callout for Phase 2 shop
 * oscuridad (handoff 2026-05-30 §1). Renders only when count > 0 and
 * the match is in-play; suppressed in end-state so the closing UI
 * doesn't compete. Reuses the canonical candy-tray-pill family + the
 * HUD_COPY shields* keys already provisioned for the hub HUD. */
function ArenaShieldsChip() {
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
          trailingControl={<ArenaTimerChip elapsedMs={elapsedMs} />}
        />
      </div>

      {/* Point-of-use shields callout — Phase 2 shop oscuridad. Only
       *  renders when the wallet has shields ready AND the match is
       *  in-play; suppressed in end-state so closing flow stays clean. */}
      {!isEndState ? (
        <div className="flex justify-end px-2">
          <ArenaShieldsChip />
        </div>
      ) : null}

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
