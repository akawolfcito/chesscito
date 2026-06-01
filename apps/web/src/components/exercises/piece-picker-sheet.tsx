"use client";

import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { PIECE_IMAGES, type PIECE_LABELS } from "@/lib/content/editorial";
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
  /** Per-piece badge claim status. Drives the "Switch piece" CTA gate
   *  — until the player has claimed at least one piece's badge, the
   *  sheet stays in pure-info mode (no switch). Pedagogical: a fresh
   *  player learning their first piece is not offered a distraction
   *  to other pieces (user feedback 2026-05-31). */
  claimedBadges?: Partial<Record<PieceOption["key"], boolean>>;
};

export function PiecePickerSheet({
  open,
  onOpenChange,
  selectedPiece,
  pieces,
  onSelectPiece,
  trigger,
  claimedBadges,
}: Props) {
  const t = useTranslations("PIECE_RAIL_COPY");
  const tPiece = useTranslations("PIECE_LABELS");
  // Switch CTA gating: only after the player has claimed at least one
  // badge (meaning they've fully completed one piece's curriculum)
  // do we surface the "Switch piece" grid. Before that, the sheet is
  // pure-info — pedagogy-first.
  const hasClaimedAnyBadge =
    claimedBadges != null && Object.values(claimedBadges).some(Boolean);
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
        title={t("title")}
        className="mission-shell sheet-bg-hub rounded-t-3xl border-white/[0.10] pb-[5rem]"
      >
        <div className="-mx-6 -mt-6 rounded-t-3xl border-b border-[rgba(110,65,15,0.30)]">
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src={PIECE_IMAGES[selectedPiece]} />}
            title={t("title")}
            close={{ onClick: () => onOpenChange(false), label: t("closeLabel") }}
          />
        </div>

        {/* Info-first section — the active piece large + its name +
            a primer line. Renders always so even a brand-new player
            opening the chip sees CONTEXT before any switch
            affordance. */}
        <div className="mt-4 flex flex-col items-center gap-2">
          <picture className="h-20 w-20">
            {THEME_CONFIG.hasOptimizedFormats && (
              <>
                <source
                  srcSet={`${PIECE_IMAGES[selectedPiece]}.avif`}
                  type="image/avif"
                />
                <source
                  srcSet={`${PIECE_IMAGES[selectedPiece]}.webp`}
                  type="image/webp"
                />
              </>
            )}
            <img
              src={`${PIECE_IMAGES[selectedPiece]}.png`}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-contain drop-shadow-[0_4px_8px_rgba(120,65,5,0.35)]"
            />
          </picture>
          <p
            className="fantasy-title text-lg font-extrabold uppercase tracking-[0.10em]"
            style={{
              color: "rgba(63, 34, 8, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
            }}
          >
            {tPiece(selectedPiece as keyof typeof PIECE_LABELS)}
          </p>
          <p
            className="text-center text-xs font-semibold"
            style={{ color: "rgba(110, 65, 15, 0.78)" }}
          >
            {t("infoSubtitle")}
          </p>
        </div>

        {/* Switch piece grid — gated. Surfaces ONLY after the player
            has claimed at least one badge. Until then the sheet is
            pure pedagogy and the player stays focused on the active
            piece. */}
        {hasClaimedAnyBadge ? (
          <p
            className="mt-5 mb-1 text-center text-[0.7rem] font-extrabold uppercase tracking-[0.16em]"
            style={{ color: "rgba(110, 65, 15, 0.65)" }}
          >
            {t("switchSectionLabel")}
          </p>
        ) : null}

        {hasClaimedAnyBadge ? (
        <div className="mt-2 grid grid-cols-3 gap-2">
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
                  {tPiece(piece.key as keyof typeof PIECE_LABELS)}
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
                    {t("comingSoon")}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
