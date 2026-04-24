"use client";

import { useEffect, useState } from "react";
import { SHARE_COPY } from "@/lib/content/editorial";
import { ShareGrid } from "@/components/share/share-grid";

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

  useEffect(() => {
    if (!open) setImgLoaded(false);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-end candy-modal-scrim animate-in fade-in duration-200"
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
        className="flex flex-1 items-center justify-center px-6 py-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative w-full max-w-[320px] overflow-hidden rounded-2xl animate-in zoom-in-95 fade-in duration-300"
          style={{
            aspectRatio: "1080 / 1350",
            background: "rgba(255, 255, 255, 0.18)",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.35)",
          }}
        >
          {cardUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cardUrl}
              alt="Share preview"
              className="h-full w-full object-cover"
              onLoad={() => setImgLoaded(true)}
            />
          ) : null}
          {!imgLoaded && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ color: "rgba(110, 65, 15, 0.55)" }}
            >
              <div
                className="h-6 w-6 animate-spin rounded-full border-2"
                style={{
                  borderColor: "rgba(110, 65, 15, 0.25)",
                  borderTopColor: "rgba(110, 65, 15, 0.85)",
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Share sheet — sheet-bg-hub for parity with dock sheets */}
      <div
        className="sheet-bg-hub w-full animate-in slide-in-from-bottom-8 duration-300"
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
            className="flex h-10 w-10 items-center justify-center rounded-full border transition-all active:scale-[0.94]"
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              borderColor: "rgba(255, 255, 255, 0.45)",
              color: "#dc2626",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="px-5 pt-5">
          <ShareGrid text={text} url={url ?? SHARE_COPY.url} cardUrl={cardUrl ?? undefined} />
        </div>
      </div>
    </div>
  );
}
