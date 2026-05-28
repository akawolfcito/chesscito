"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { ShareGrid } from "@/components/share/share-grid";
import { track } from "@/lib/telemetry";

type Props = {
  /** Modal visibility. */
  open: boolean;
  /** Called when the user taps the close × or the dimmed scrim. */
  onOpenChange: (open: boolean) => void;
  /** Absolute URL to the preview PNG/JPEG rendered by an /api/og/* endpoint. */
  cardUrl: string | null;
  /** Text to share (passed through to ShareGrid → service URLs). */
  text: string;
  /** URL to share (falls back to SHARE_COPY.url). */
  url?: string;
  /** Modal header copy. Defaults to "Share". */
  title?: string;
};

/**
 * ShareModal — Duolingo-style preview + share sheet.
 *
 * Renders a dimmed scrim, the OG card preview near the top, then a
 * candy-light sheet from the bottom with the colorful ShareGrid.
 * Pair with the /api/og/* endpoints: endpoint renders the PNG,
 * modal displays + shares it.
 */
export function ShareModal({
  open,
  onOpenChange,
  cardUrl,
  text,
  url,
  title: titleProp,
}: Props) {
  const t = useTranslations("SHARE_MODAL_COPY");
  const tShare = useTranslations("SHARE_COPY");
  const title = titleProp ?? t("defaultTitle");
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!open) {
      setImgLoaded(false);
      setImgError(false);
      return;
    }
    track("share_modal_open", {
      title,
      has_card: Boolean(cardUrl),
    });
  }, [open, title, cardUrl]);

  if (!open) return null;
  // Render via portal so the modal escapes any ancestor containing
  // block (parent CandyGlassShell modals use CSS animations that set
  // transform on the panel, which would otherwise constrain our
  // `fixed inset-0` to the panel rect instead of the viewport).
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-end candy-modal-scrim animate-in fade-in duration-200 overflow-hidden"
      style={{ pointerEvents: "auto" }}
      onClick={() => onOpenChange(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onOpenChange(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
    >
      {/* Mobile-sim viewport guard — caps both the preview area and
          the bottom sheet at --app-max-width so on desktop the share
          UI stays inside the simulated 390px frame instead of spanning
          the full viewport. Scrim still dims the entire screen. */}
      <div className="flex flex-1 w-full max-w-[var(--app-max-width)] flex-col items-center overflow-hidden">
        {/* Preview card */}
        <div
          className="flex flex-1 items-center justify-center px-4 py-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="relative w-full max-w-[300px] max-h-full overflow-hidden rounded-xl animate-in zoom-in-95 fade-in duration-300"
            style={{
              aspectRatio: "1080 / 1350",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
            }}
          >
            {cardUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cardUrl}
                alt={t("previewAlt")}
                className="h-full w-full object-contain"
                onLoad={() => setImgLoaded(true)}
                onError={() => { setImgLoaded(true); setImgError(true); }}
              />
            ) : null}
            {!imgLoaded && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ color: "rgba(110, 65, 15, 0.55)" }}
              >
                <div
                  className="h-6 w-6 animate-spin rounded-full border-2"
                  style={{
                    borderColor: "rgba(110, 65, 15, 0.25)",
                    borderTopColor: "rgba(110, 65, 15, 0.85)",
                  }}
                />
                <span
                  className="text-xs font-semibold"
                  style={{ color: "rgba(110, 65, 15, 0.60)" }}
                >
                  {t("generatingCard")}
                </span>
              </div>
            )}
            {imgError && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ color: "rgba(110, 65, 15, 0.45)" }}
              >
                <span className="text-center text-xs leading-snug px-4">
                  {t("previewUnavailable")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Share sheet — sheet-bg-hub for parity with dock sheets */}
        <div
          className="sheet-bg-hub w-full flex-shrink-0 animate-in slide-in-from-bottom-8 duration-300"
          onClick={(e) => e.stopPropagation()}
          style={{
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
            boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.18)",
          }}
        >
          <div className="border-b border-[rgba(110,65,15,0.30)]">
            <ContextualHeader
              variant="close-control"
              icon="share"
              title={title}
              close={{ onClick: () => onOpenChange(false), label: t("closeLabel") }}
            />
          </div>
          {/* Cream candy-panel wraps the icon grid so the icons read as
              a contained card on top of the short sheet, matching the
              visual rhythm of dock sheets (which are full-height and
              show more bg-ch texture above the content). */}
          <div className="px-4 pt-4 pb-2">
            <div
              className="rounded-[var(--candy-card-radius)] border border-[rgba(110,65,15,0.18)] p-4"
              style={{
                background: "rgba(255, 245, 215, 0.55)",
                boxShadow: "0 2px 6px rgba(110, 65, 15, 0.08)",
              }}
            >
              <ShareGrid text={text} url={url ?? tShare("url")} cardUrl={cardUrl ?? undefined} />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
