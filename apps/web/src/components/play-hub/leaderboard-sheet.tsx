import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type LeaderboardRow = {
  rank: number;
  player: string;
  score: number;
};

type LeaderboardSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: readonly LeaderboardRow[];
};

export function LeaderboardSheet({ open, onOpenChange, rows }: LeaderboardSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button className="border-cyan-500/40 text-cyan-100 hover:bg-cyan-900/35" variant="outline">Leaderboard</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mission-shell rounded-t-3xl border-slate-700">
        <SheetHeader>
          <SheetTitle className="fantasy-title text-cyan-50">Hall of Rooks</SheetTitle>
          <SheetDescription className="text-cyan-100/75">Vista rápida sin salir del tablero.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 rune-frame rounded-xl border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          Bonus visual: top 3 con prioridad para recompensa social y screenshot.
        </div>
        <div className="mt-4 space-y-2">
          {rows.map((row) => (
            <div key={row.rank} className="mission-soft rune-frame grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-3 py-2">
              <p className="text-sm font-semibold text-cyan-100">{row.rank === 1 ? "TOP" : `#${row.rank}`}</p>
              <p className="text-sm text-slate-300">{row.player}</p>
              <p className="text-sm font-semibold text-cyan-100">{row.score}</p>
            </div>
          ))}
          <Link className="mt-2 inline-flex text-xs font-semibold text-cyan-300 underline-offset-2 hover:underline" href="/leaderboard">
            Ver leaderboard completo
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
