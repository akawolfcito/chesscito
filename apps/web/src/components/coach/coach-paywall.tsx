"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { TreasureTile } from "@/components/scene-rooted/treasure-tile";
import { track } from "@/lib/telemetry";

/** M1 funnel — telemetry context for paywall events. Other surfaces
 *  (win/draw, journal) are reserved for later commits. */
export type CoachPaywallContext = "endgame_loss" | "endgame_resign";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBuy: (pack: 5 | 20) => void;
  /** M1 funnel (Commit 3) — opens the PRO sheet from the paywall.
   *  Optional so legacy callers keep working; when omitted, the PRO
   *  tier slot is not rendered. */
  onSeePro?: () => void;
  /** M1 funnel (Commit 3) — namespaces telemetry to the originating
   *  endgame surface. When omitted, paywall renders but emits no
   *  monetization.* events (legacy / dev fixture path). */
  context?: CoachPaywallContext;
};

const PACK_PRICE: Record<5 | 20, string> = {
  5: "$0.05",
  20: "$0.10",
};

function CoinStack({ count }: { count: number }) {
  return (
    <span
      className="flex flex-col items-center gap-0.5 leading-none"
      aria-hidden="true"
    >
      <span className="text-2xl">🪙</span>
      <span className="text-base font-extrabold drop-shadow-[0_1px_0_rgba(0,0,0,0.45)]">
        ×{count}
      </span>
    </span>
  );
}

export function CoachPaywall({
  open,
  onOpenChange,
  onBuy,
  onSeePro,
  context,
}: Props) {
  const t = useTranslations("COACH_COPY");
  const [buying, setBuying] = useState<5 | 20 | null>(null);
  // Tracks whether the dismiss telemetry was already fired through an
  // explicit "Later" tap so the onOpenChange callback (which Radix also
  // fires on backdrop swipe + X close) doesn't double-emit the event.
  const explicitDismissRef = useRef(false);

  // M1 funnel — fire view + preview_view exactly once per open transition
  // so consumers re-opening the paywall after a previous close still get
  // counted. Skipped when `context` is undefined (legacy / dev fixture).
  useEffect(() => {
    if (!open || !context) return;
    track("monetization.coach_paywall_view", { context });
    track("monetization.coach_paywall_preview_view", { context });
  }, [open, context]);

  function emitDismiss(reason: "explicit" | "backdrop") {
    if (context) {
      track("monetization.coach_paywall_dismiss", { context, reason });
    }
  }

  function handleBuy(pack: 5 | 20) {
    setBuying(pack);
    if (context) {
      track("monetization.coach_paywall_convert", {
        context,
        tier: pack === 5 ? "pack_5" : "pack_20",
      });
    }
    onBuy(pack);
  }

  function handleSeePro() {
    if (buying) return;
    if (context) {
      track("monetization.coach_paywall_convert", { context, tier: "pro" });
    }
    explicitDismissRef.current = true;
    emitDismiss("explicit");
    onSeePro?.();
    onOpenChange(false);
  }

  function handleLater() {
    if (buying) return;
    explicitDismissRef.current = true;
    emitDismiss("explicit");
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (buying) return;
    if (!next && !explicitDismissRef.current) {
      // Dismissed via backdrop swipe or the header close button.
      emitDismiss("backdrop");
    }
    if (!next) explicitDismissRef.current = false;
    onOpenChange(next);
  }

  const heading = t("paywallHeading");
  const previewLabel = t("paywallPreviewLabel");
  const previewTitle = t("paywallPreviewTitle");
  const previewBody = t("paywallPreviewBody");
  const pack5Cta = t("paywallPack5Cta");
  const pack20Cta = t("paywallPack20Cta");
  const proCta = t("paywallProCta");
  const dismissCta = t("paywallDismiss");
  // Legacy header still surfaces the canonical Coach voice line as
  // subtitle so the paywall keeps its emotional anchor.
  const creditExplain = t("creditExplain");

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        title={heading}
        description={creditExplain}
        className="mission-shell sheet-bg-hub flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        <div className="-mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
          <ContextualHeader
            variant="close-control"
            iconSlot={<TileIconSlot src="/art/new-icons-chesscito/learning" />}
            title={heading}
            subtitle={creditExplain}
            close={{
              onClick: () => !buying && handleOpenChange(false),
              label: "Close paywall",
            }}
          />
        </div>

        {/* M1 funnel (Commit 3) — sample preview band. Static copy from
            editorial so the user sees the SHAPE of what a paid review
            delivers before committing. No LLM call, no credit consumption,
            not derived from the current gameId. */}
        <section
          aria-label={previewLabel}
          className="mt-5 rounded-2xl px-4 py-3"
          style={{
            background: "rgba(255, 245, 215, 0.55)",
            border: "1px solid rgba(110, 65, 15, 0.22)",
            boxShadow: "inset 0 1px 0 rgba(255, 245, 215, 0.55)",
          }}
        >
          <p
            className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em]"
            style={{ color: "rgba(110, 65, 15, 0.78)" }}
          >
            {previewLabel}
          </p>
          <p
            className="mt-1 text-sm font-extrabold"
            style={{
              color: "rgba(63, 34, 8, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
            }}
          >
            {previewTitle}
          </p>
          <p
            className="mt-1 text-xs leading-snug"
            style={{ color: "rgba(110, 65, 15, 0.82)" }}
          >
            {previewBody}
          </p>
        </section>

        <div className="mt-6 grid grid-cols-2 place-items-center gap-3">
          <div className="flex flex-col items-center gap-2">
            <TreasureTile
              size="small"
              iconStack={<CoinStack count={5} />}
              valueChip={PACK_PRICE[5]}
              onClick={() => handleBuy(5)}
              loading={buying === 5}
              disabled={buying !== null && buying !== 5}
              aria-label={`${pack5Cta} · ${PACK_PRICE[5]}`}
            />
            <p
              className="text-xs font-semibold opacity-75"
              style={{ color: "rgba(110, 65, 15, 0.85)" }}
            >
              {pack5Cta}
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <TreasureTile
              size="large"
              iconStack={<CoinStack count={20} />}
              valueChip={PACK_PRICE[20]}
              ribbon="BEST"
              onClick={() => handleBuy(20)}
              loading={buying === 20}
              disabled={buying !== null && buying !== 20}
              aria-label={`${pack20Cta} · ${PACK_PRICE[20]}`}
            />
            <p
              className="text-xs font-semibold opacity-80"
              style={{ color: "rgba(110, 65, 15, 0.85)" }}
            >
              {pack20Cta}
            </p>
          </div>
        </div>

        {buying && (
          <p
            className="mt-3 text-center text-sm font-semibold animate-in fade-in duration-200"
            style={{ color: "rgba(110, 65, 15, 0.75)" }}
          >
            {t("buyWithUsdc")}
          </p>
        )}

        {/* M1 funnel (Commit 3) — PRO as a worthy recurring alternative,
            not a cramped footnote. Rendered only when the consumer wires
            an `onSeePro` handler. */}
        {onSeePro && (
          <button
            type="button"
            onClick={handleSeePro}
            disabled={buying !== null}
            aria-label={proCta}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background:
                "linear-gradient(180deg, rgba(255, 235, 175, 0.95), rgba(232, 184, 84, 0.95))",
              color: "rgba(63, 34, 8, 0.95)",
              border: "1px solid rgba(180, 120, 35, 0.55)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.6)",
              boxShadow:
                "0 3px 0 rgba(135, 82, 13, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.55)",
            }}
          >
            {proCta}
          </button>
        )}

        <p
          className="mt-4 text-center text-xs"
          style={{ color: "rgba(110, 65, 15, 0.55)" }}
        >
          <button
            type="button"
            onClick={handleLater}
            disabled={buying !== null}
            className="underline hover:opacity-80 disabled:opacity-50"
          >
            {dismissCta}
          </button>
        </p>
      </SheetContent>
    </Sheet>
  );
}
