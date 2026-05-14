"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SHARE_COPY } from "@/lib/content/editorial";
import { CandyIcon } from "@/components/redesign/candy-icon";
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
  title = "Share",
}: Props) {
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
      onClick={() => onOpenChange(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onOpenChange(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
    >
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
              alt="Share preview"
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
                Generating your card…
              </span>
            </div>
          )}
          {imgError && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: "rgba(110, 65, 15, 0.45)" }}
            >
              <span className="text-center text-xs leading-snug px-4">
                Card preview unavailable
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
        <div className="flex items-center justify-between border-b border-[rgba(110,65,15,0.30)] px-5 py-4">
          <h3
            className="fantasy-title text-sm font-extrabold uppercase tracking-[0.18em]"
            style={{
              color: "rgba(110, 65, 15, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
            }}
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full border transition-all active:scale-[0.94]"
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              borderColor: "rgba(255, 255, 255, 0.45)",
              color: "#dc2626",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          >
            <CandyIcon name="close" className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 pt-5">
          <ShareGrid text={text} url={url ?? SHARE_COPY.url} cardUrl={cardUrl ?? undefined} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
