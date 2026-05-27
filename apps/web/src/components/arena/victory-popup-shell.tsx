"use client";

import type { ReactNode } from "react";

type Props = {
  /** Optional close handler. When provided, X + backdrop tap call this
   *  to dismiss the popup without navigating (Sally's retention-loop
   *  pattern shared with the loss popup). When omitted, the backdrop
   *  + X are inert. */
  onClose?: () => void;
  /** Accessible label for the dialog — usually the headline text. */
  ariaLabel?: string;
  /** Optional aria-live region. Use "alert" for win celebrations to
   *  announce victory to assistive tech. */
  role?: "dialog" | "alert";
  ariaLive?: "polite" | "assertive";
  /** Aria label for the close button (e.g. "Close victory dialog"). */
  closeLabel?: string;
  children: ReactNode;
};

/**
 * Shared shell for all 4 victory popup states (celebration, claiming,
 * success, error). Same vocabulary as the loss popup:
 *   - candy-modal-scrim backdrop (60% black, no blur)
 *   - panel-bg1 forest-cream panel asset
 *   - candy-close-asset-button X anchored top-right at 4%
 *   - arena-result-popup-content inner wrapper with percentage padding
 *
 * Pure presentation — no mint/share/coach logic. Children control
 * everything inside the panel.
 */
export function VictoryPopupShell({
  onClose,
  ariaLabel,
  role = "dialog",
  ariaLive,
  closeLabel = "Close",
  children,
}: Props) {
  return (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
    <div
      className="candy-modal-scrim pointer-events-auto fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-300"
      role={role}
      aria-modal="true"
      aria-label={ariaLabel}
      aria-live={ariaLive}
      onClick={() => onClose?.()}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="relative mx-4 w-full max-w-[340px] max-h-[92dvh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundImage:
            'image-set(url("/art/new-assets-chesscito/paneles/panel-bg1.avif") type("image/avif"), url("/art/new-assets-chesscito/paneles/panel-bg1.webp") type("image/webp"), url("/art/new-assets-chesscito/paneles/panel-bg1.png") type("image/png"))',
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="candy-close-asset-button absolute right-[4%] top-[4%] z-10"
          >
            <picture>
              <source srcSet="/art/screen-mission/close-icon.avif" type="image/avif" />
              <source srcSet="/art/screen-mission/close-icon.webp" type="image/webp" />
              <img
                src="/art/screen-mission/close-icon.png"
                alt=""
                aria-hidden="true"
                className="h-10 w-10 object-contain"
                draggable={false}
              />
            </picture>
          </button>
        )}

        <div className="flex flex-col arena-result-popup-content">
          {children}
        </div>
      </div>
    </div>
  );
}
