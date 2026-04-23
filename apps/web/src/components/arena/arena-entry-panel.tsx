"use client";

import { ARENA_COPY } from "@/lib/content/editorial";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { Button } from "@/components/ui/button";
import type { ArenaDifficulty } from "@/lib/game/types";
import type { PlayerColor } from "@/lib/game/use-chess-game";

type Props = {
  difficulty: ArenaDifficulty;
  playerColor: PlayerColor;
  onSelectDifficulty: (d: ArenaDifficulty) => void;
  onSelectColor: (c: PlayerColor) => void;
  onStart: () => void;
  /** Optional back/close button. When provided renders a red × in the
   *  header and a "Back to Hub" secondary action under the CTA. */
  onBack?: () => void;
  /** Hide the outer candy-glass shell when the panel is embedded inside
   *  a Sheet that already paints its own background (e.g. ArenaEntrySheet
   *  inside sheet-bg-hub). */
  bare?: boolean;
};

const LEVELS: { key: ArenaDifficulty; dot: string }[] = [
  { key: "easy", dot: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.45)]" },
  { key: "medium", dot: "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.45)]" },
  { key: "hard", dot: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.45)]" },
];

const COLOR_OPTIONS: { key: PlayerColor; label: string }[] = [
  { key: "w", label: ARENA_COPY.playAsWhite },
  { key: "b", label: ARENA_COPY.playAsBlack },
];

/**
 * ArenaEntryPanel — difficulty + color picker body.
 *
 * One body, two mounts: used standalone on /arena (post-game or direct
 * entry fallback) wrapped in candy-glass, and inside ArenaEntrySheet
 * (dock entry) where `bare` drops the outer glass since the Sheet
 * provides sheet-bg-hub already.
 */
export function ArenaEntryPanel({
  difficulty,
  playerColor,
  onSelectDifficulty,
  onSelectColor,
  onStart,
  onBack,
  bare = false,
}: Props) {
  const shellStyle = bare
    ? undefined
    : {
        background: "rgba(255, 255, 255, 0.18)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(255, 255, 255, 0.45)",
        boxShadow:
          "0 10px 28px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 245, 215, 0.55)",
      };

  return (
    <div
      className={
        bare
          ? "flex w-full flex-col gap-3"
          : "relative mx-auto flex w-full max-w-xs flex-col gap-3 overflow-hidden rounded-3xl px-5 py-5"
      }
      style={shellStyle}
    >
      {!bare && (
        <div className="flex items-center justify-between border-b border-[rgba(110,65,15,0.30)] pb-3 -mx-2">
          <h2
            className="fantasy-title px-2 text-lg font-extrabold"
            style={{
              color: "rgba(110, 65, 15, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
            }}
          >
            {ARENA_COPY.title}
          </h2>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={ARENA_COPY.backToHub}
              className="mr-2 flex h-10 w-10 items-center justify-center rounded-full border transition-all active:scale-[0.94]"
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                borderColor: "rgba(255, 255, 255, 0.45)",
                color: "#dc2626",
                backdropFilter: "blur(6px)",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
      )}

      <p
        className="text-center text-xs"
        style={{ color: "rgba(110, 65, 15, 0.70)" }}
      >
        {ARENA_COPY.subtitle}
      </p>

      {/* Color toggle — Play as White / Black */}
      <div
        className="grid grid-cols-2 gap-1.5 rounded-full p-1"
        style={{
          background: "rgba(255, 255, 255, 0.18)",
          border: "1px solid rgba(255, 255, 255, 0.45)",
        }}
        role="group"
        aria-label="Choose your color"
      >
        {COLOR_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelectColor(key)}
            aria-pressed={playerColor === key}
            className={[
              "rounded-full px-2 py-1.5 text-xs font-bold transition-all",
              playerColor === key
                ? "bg-amber-500/95 text-[rgba(63,34,8,0.95)] shadow-[0_1px_0_rgba(110,65,15,0.35),inset_0_1px_0_rgba(255,255,255,0.35)]"
                : "text-[rgba(110,65,15,0.75)] active:scale-[0.97]",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Difficulty levels */}
      <div className="flex flex-col gap-1.5">
        {LEVELS.map(({ key, dot }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelectDifficulty(key)}
            aria-pressed={difficulty === key}
            className={[
              "flex items-center gap-2.5 rounded-2xl border px-2.5 py-2 text-left transition-all",
              difficulty === key
                ? "border-amber-500/75 bg-amber-400/20 ring-2 ring-amber-400/40"
                : "border-[rgba(255,255,255,0.45)] bg-white/15 hover:bg-white/25 active:scale-[0.98]",
            ].join(" ")}
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
            <div className="min-w-0 flex-1">
              <span
                className="text-sm font-extrabold"
                style={{
                  color: "rgba(63, 34, 8, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
                }}
              >
                {ARENA_COPY.difficulty[key]}
              </span>
              <p
                className="truncate text-[0.7rem] leading-snug"
                style={{ color: "rgba(110, 65, 15, 0.70)" }}
              >
                {ARENA_COPY.difficultyDesc[key]}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Primary CTA */}
      <Button
        type="button"
        variant="game-primary"
        size="game"
        onClick={onStart}
        className="mt-1 w-full"
      >
        <CandyBanner name="btn-play" className="inline h-5 w-5 -mt-0.5" />{" "}
        {ARENA_COPY.startMatch}
      </Button>

      {/* Secondary: Back */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-1 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
          style={{ color: "rgba(110, 65, 15, 0.75)" }}
        >
          <CandyBanner name="btn-back" className="h-4 w-4" />
          {ARENA_COPY.backToHub}
        </button>
      )}
    </div>
  );
}
