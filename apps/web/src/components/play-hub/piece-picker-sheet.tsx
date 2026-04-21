"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PIECE_IMAGES, PIECE_LABELS, PIECE_RAIL_COPY } from "@/lib/content/editorial";
import { THEME_CONFIG } from "@/lib/theme";

type PieceOption = {
  key: "rook" | "bishop" | "knight" | "pawn" | "queen" | "king";
  label: string;
  enabled: boolean;
};

type Props = {
  /** Controlled open state — parent closes it when a dock sheet opens,
   *  so the user never sees stacked pickers. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPiece: PieceOption["key"];
  pieces: readonly PieceOption[];
  onSelectPiece: (piece: PieceOption["key"]) => void;
  /** The chip element that opens the sheet. */
  trigger: React.ReactNode;
};

export function PiecePickerSheet({ open, onOpenChange, selectedPiece, pieces, onSelectPiece, trigger }: Props) {
  function handleSelect(piece: PieceOption["key"]) {
    onSelectPiece(piece);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="mission-shell sheet-bg-hub rounded-t-3xl border-white/[0.10] pb-[5rem]"
      >
        <div className="border-b border-[var(--header-zone-border)] bg-[var(--header-zone-bg)] -mx-6 -mt-6 rounded-t-3xl px-6 py-5">
          <SheetHeader>
            <SheetTitle className="fantasy-title text-slate-100">
              {PIECE_RAIL_COPY.title}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {PIECE_RAIL_COPY.title}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {pieces.map((piece) => {
            const isActive = selectedPiece === piece.key;
            const isLocked = !piece.enabled;
            const src = PIECE_IMAGES[piece.key as keyof typeof PIECE_IMAGES];
            return (
              <button
                key={piece.key}
                type="button"
                disabled={isLocked}
                onClick={() => handleSelect(piece.key)}
                className={[
                  "flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 transition-all min-h-[88px]",
                  isActive
                    ? "border-cyan-400/60 bg-cyan-400/10 ring-2 ring-cyan-400/30"
                    : isLocked
                      ? "border-white/[0.04] bg-white/[0.02] opacity-50 cursor-not-allowed"
                      : "border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.97]",
                ].join(" ")}
                aria-label={piece.label}
              >
                <picture className="h-10 w-10 shrink-0">
                  {THEME_CONFIG.hasOptimizedFormats && (
                    <>
                      <source srcSet={`${src}.avif`} type="image/avif" />
                      <source srcSet={`${src}.webp`} type="image/webp" />
                    </>
                  )}
                  <img
                    src={`${src}.png`}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-contain"
                  />
                </picture>
                <span className="game-label text-xs font-bold uppercase tracking-[0.10em] text-white/85">
                  {PIECE_LABELS[piece.key as keyof typeof PIECE_LABELS]}
                </span>
                {isLocked ? (
                  <span className="flex items-center gap-1 text-nano font-bold uppercase tracking-[0.12em] text-white/40">
                    <CandyIcon name="lock" className="h-3 w-3" />
                    {PIECE_RAIL_COPY.comingSoon}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
