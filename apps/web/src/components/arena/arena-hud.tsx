"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { CandyBanner } from "@/components/redesign/candy-banner";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { PlayerAvatar } from "@/components/redesign/player-avatar";
import { WoodenBanner } from "@/components/redesign/wooden-banner";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { formatTime } from "@/lib/game/arena-utils";

type Props = {
  isThinking: boolean;
  onBack: () => void;
  isEndState?: boolean;
  elapsedMs: number;
  /** When true (and the game is not yet in end-state), render the
   *  in-match Coach signpost beneath the matchup row. Gated by
   *  NEXT_PUBLIC_ENABLE_COACH at the call site (arena/page.tsx). */
  showCoachHint?: boolean;
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

/* Custom timer chip — purpose-built to escape HudResourceChip's
 * 240ms is-pulse flash that triggered on every per-second tick
 * (constant shadow flicker + width jitter). Uses tabular-nums so the
 * value can grow from "0:00" → "99:59" without layout shifts, and
 * floats an oversized clock icon off the chip's left edge so the
 * glyph reads as the badge and the time reads as the label. */
function ArenaTimerChip({ elapsedMs }: { elapsedMs: number }) {
  const t = useTranslations("ARENA_COPY");
  const value = formatTime(elapsedMs);
  return (
    <span
      className="arena-timer-chip"
      role="status"
      aria-live="polite"
      aria-label={t("timerAriaLabel", { time: value })}
    >
      <CandyIcon name="time" className="arena-timer-chip-icon" />
      <span className="arena-timer-chip-value">{value}</span>
    </span>
  );
}

export function ArenaHud({
  isThinking,
  onBack,
  isEndState,
  elapsedMs,
}: Props) {
  const t = useTranslations("ARENA_COPY");
  const needsBackConfirm = !isEndState;

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

      {/* Row 2: Matchup art (Heads) — Symmetric Battle Header */}
      <div className="arena-hud-matchup relative flex items-center justify-between px-2 pt-2">
        <div className="flex flex-1 justify-center">
          <PlayerAvatar variant="you" className="h-24 w-24 drop-shadow-xl" />
        </div>

        <div className="flex shrink-0 items-center justify-center">
          <WoodenBanner variant="vs" className="scale-90 drop-shadow-lg" />
        </div>

        <div className="relative flex flex-1 justify-center">
          <PlayerAvatar variant="bot" className="h-24 w-24 drop-shadow-xl" />
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
