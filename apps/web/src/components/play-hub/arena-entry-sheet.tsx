"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ARENA_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";
import { CandyBanner } from "@/components/redesign/candy-banner";
import type { ArenaDifficulty } from "@/lib/game/types";
import type { PlayerColor } from "@/lib/game/use-chess-game";

const LAST_DIFFICULTY_KEY = "chesscito:arena-last-difficulty";
export const ARENA_INTENT_KEY = "chesscito:arena-intent";

const LEVELS: { key: ArenaDifficulty; dot: string }[] = [
  { key: "easy", dot: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.45)]" },
  { key: "medium", dot: "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.45)]" },
  { key: "hard", dot: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.45)]" },
];

const COLOR_OPTIONS: { key: PlayerColor; label: string }[] = [
  { key: "w", label: ARENA_COPY.playAsWhite },
  { key: "b", label: ARENA_COPY.playAsBlack },
];

function loadLastDifficulty(): ArenaDifficulty {
  if (typeof window === "undefined") return "easy";
  try {
    const raw = localStorage.getItem(LAST_DIFFICULTY_KEY);
    if (raw === "easy" || raw === "medium" || raw === "hard") return raw;
  } catch { /* ignore */ }
  return "easy";
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
};

/**
 * ArenaEntrySheet — dock-triggered difficulty/color picker.
 *
 * Lives in the dock alongside Badges/Shop/Leaderboard. On confirm,
 * writes the picked difficulty+color to sessionStorage under
 * `chesscito:arena-intent` and navigates to /arena, where the page
 * reads the key and auto-starts the match. Keeps /arena's URL clean
 * (no ?diff=... params) and avoids lifting useChessGame state above
 * the route.
 */
export function ArenaEntrySheet({ open, onOpenChange, trigger }: Props) {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<ArenaDifficulty>(loadLastDifficulty);
  const [playerColor, setPlayerColor] = useState<PlayerColor>("w");

  function handleStart() {
    try {
      sessionStorage.setItem(
        ARENA_INTENT_KEY,
        JSON.stringify({ difficulty, color: playerColor }),
      );
    } catch { /* storage unavailable — arena falls back to selector */ }
    onOpenChange(false);
    router.push("/arena");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="mission-shell sheet-bg-hub rounded-t-3xl border-0 pb-[5rem]"
      >
        <div className="border-b border-[rgba(110,65,15,0.30)] -mx-6 -mt-6 rounded-t-3xl px-6 py-5">
          <SheetHeader>
            <SheetTitle
              className="fantasy-title flex items-center gap-2"
              style={{
                color: "rgba(110, 65, 15, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
              }}
            >
              <CandyBanner name="btn-battle" className="h-5 w-5" />
              {ARENA_COPY.title}
            </SheetTitle>
            <SheetDescription style={{ color: "rgba(110, 65, 15, 0.75)" }}>
              {ARENA_COPY.subtitle}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="mt-4 flex flex-col gap-3">
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
                onClick={() => setPlayerColor(key)}
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
                onClick={() => setDifficulty(key)}
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
            onClick={handleStart}
            className="mt-1 w-full"
          >
            <CandyBanner name="btn-play" className="inline h-5 w-5 -mt-0.5" />{" "}
            {ARENA_COPY.startMatch}
          </Button>

          {/* Secondary: close */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center gap-1 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
            style={{ color: "rgba(110, 65, 15, 0.75)" }}
          >
            <CandyBanner name="btn-back" className="h-4 w-4" />
            {ARENA_COPY.backToHub}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
