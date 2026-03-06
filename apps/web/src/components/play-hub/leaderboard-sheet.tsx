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
        <Button variant="outline">Leaderboard</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mission-shell rounded-t-3xl border-slate-700">
        <SheetHeader>
          <SheetTitle>Leaderboard</SheetTitle>
          <SheetDescription>Vista rapida sin salir del Play Hub.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {rows.map((row) => (
            <div key={row.rank} className="mission-soft grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-3 py-2">
              <p className="text-sm font-semibold text-slate-100">#{row.rank}</p>
              <p className="text-sm text-slate-300">{row.player}</p>
              <p className="text-sm font-semibold text-slate-100">{row.score}</p>
            </div>
          ))}
          <Link className="mt-2 inline-flex text-xs font-semibold text-primary" href="/leaderboard">
            Ver leaderboard completo
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
