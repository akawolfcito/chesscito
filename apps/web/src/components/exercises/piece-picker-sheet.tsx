"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
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
  /** Optional chip element that opens the sheet. When omitted, the sheet
   *  is purely controlled — the parent owns a separate trigger button and
   *  flips `open` directly. This is the Phase-2 zone-map pattern: trigger
   *  lives in Z2 (`<ContextualHeader>`), sheet renders as a sibling. */
  trigger?: React.ReactNode;
};

export function PiecePickerSheet({ open, onOpenChange, selectedPiece, pieces, onSelectPiece, trigger }: Props) {
  function handleSelect(piece: PieceOption["key"]) {
    onSelectPiece(piece);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent
        side="bottom"
        hideClose
        title={PIECE_RAIL_COPY.title}
        className="mission-shell sheet-bg-hub rounded-t-3xl border-white/[0.10] pb-[5rem]"
      >
        <div className="-mx-6 -mt-6 rounded-t-3xl border-b border-[rgba(110,65,15,0.30)]">
          <ContextualHeader
            variant="close-control"
            title={PIECE_RAIL_COPY.title}
            close={{ onClick: () => onOpenChange(false), label: "Close piece picker" }}
          />
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
                    ? "border-amber-400/75 bg-amber-400/15 ring-2 ring-amber-400/40"
                    : isLocked
                      ? "border-[rgba(255,255,255,0.25)] bg-white/10 opacity-55 cursor-not-allowed"
                      : "border-[rgba(255,255,255,0.45)] bg-white/15 hover:bg-white/25 active:scale-[0.97]",
                ].join(" ")}
                aria-label={piece.label}
                aria-pressed={isActive}
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
                <span
                  className="fantasy-title text-xs font-extrabold uppercase tracking-[0.10em]"
                  style={{
                    color: "rgba(63, 34, 8, 0.95)",
                    textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
                  }}
                >
                  {PIECE_LABELS[piece.key as keyof typeof PIECE_LABELS]}
                </span>
                {isLocked ? (
                  <span
                    className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-nano font-extrabold uppercase tracking-[0.12em]"
                    style={{
                      background: "rgba(120, 65, 5, 0.85)",
                      color: "rgba(255, 240, 180, 0.98)",
                      letterSpacing: "0.10em",
                    }}
                  >
                    <CandyIcon name="lock" className="h-2.5 w-2.5" />
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
