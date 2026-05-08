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
import { CandyBanner } from "@/components/redesign/candy-banner";
import { ArenaEntryPanel } from "@/components/arena/arena-entry-panel";
import type { ArenaDifficulty } from "@/lib/game/types";
import type { PlayerColor } from "@/lib/game/use-chess-game";

const LAST_DIFFICULTY_KEY = "chesscito:arena-last-difficulty";
export const ARENA_INTENT_KEY = "chesscito:arena-intent";

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
        className="mission-shell sheet-bg-hub flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        <div className="shrink-0 border-b border-[rgba(110,65,15,0.30)] -mx-6 -mt-6 rounded-none px-6 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
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

        <div className="mt-4">
          <ArenaEntryPanel
            bare
            difficulty={difficulty}
            playerColor={playerColor}
            onSelectDifficulty={setDifficulty}
            onSelectColor={setPlayerColor}
            onStart={handleStart}
            onBack={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
