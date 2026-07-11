"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  /** Optional close handler. When provided, X tap calls this to dismiss
   *  the popup (Sally's retention-loop pattern shared with the loss
   *  popup). Backdrop tap also routes here UNLESS
   *  `disableBackdropClose` is true. When omitted, both surfaces are
   *  inert. */
  onClose?: () => void;
  /** When true, backdrop tap is a no-op while X tap still dismisses.
   *  Used by win popups with a primary mint CTA visible: accidental
   *  backdrop dismissal would hide the Save Victory affordance with no
   *  in-flow way to re-summon it (#114). Defaults to false (legacy
   *  behavior: backdrop tap == X tap). */
  disableBackdropClose?: boolean;
  /** Accessible label for the dialog — usually the headline text. */
  ariaLabel?: string;
  /** Optional aria-live region. Use "alert" for win celebrations to
   *  announce victory to assistive tech. */
  role?: "dialog" | "alert";
  ariaLive?: "polite" | "assertive";
  /** Aria label for the close button (e.g. "Close victory dialog"). */
  closeLabel?: string;
  /** When true, render the scrim into `document.body` via a portal so it
   *  escapes any transformed ancestor. A Radix Sheet's slide-in applies a
   *  `transform` to its content, which turns `position: fixed` into
   *  sheet-relative and traps this modal INSIDE the sheet (it then reads as
   *  an "interior screen" and its z-index is scoped under the dock). Aux
   *  modals opened from a sheet (Get Peones from the Account sheet) set this.
   *  Default false — arena/exercises popups already mount at the app root. */
  portal?: boolean;
  /** Tailwind z-index utility for the scrim. Default `z-[70]` sits ABOVE the
   *  PersistentDock (z-60). Aux-family modals pass `z-[55]` to cover the
   *  z-50 aux sheet while staying UNDER the dock. */
  scrimZClassName?: string;
  /** Overrides the `panel-bg1` panel art with a full-panel background (frame
   *  included). Pass a CSS `image-set(...)` string. The Season Pass
   *  celebration uses this: its art bakes in the frame, shield and garden, so
   *  layering it over panel-bg1 would double the frame. */
  panelBackgroundImage?: string;
  /** Extra classes on the panel — e.g. an `aspect-*` ratio so a full-panel
   *  background art is not stretched by `backgroundSize: 100% 100%`. */
  panelClassName?: string;
  children: ReactNode;
};

const DEFAULT_PANEL_BG =
  'image-set(url("/art/new-assets-chesscito/paneles/panel-bg1.avif") type("image/avif"), url("/art/new-assets-chesscito/paneles/panel-bg1.webp") type("image/webp"), url("/art/new-assets-chesscito/paneles/panel-bg1.png") type("image/png"))';

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
  disableBackdropClose = false,
  ariaLabel,
  role = "dialog",
  ariaLive,
  closeLabel = "Close",
  portal = false,
  scrimZClassName = "z-[70]",
  panelBackgroundImage = DEFAULT_PANEL_BG,
  panelClassName = "",
  children,
}: Props) {
  const handleBackdropClick = disableBackdropClose ? undefined : () => onClose?.();
  const scrim = (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
    <div
      // Default z-[70] sits above the PersistentDock (z-60 in globals.css) so
      // the scrim dims the dock and the modal panel is the only interactive
      // surface. Earlier z-50 left the dock visually on top of the modal
      // in exercises popups (piece-complete / labyrinth-solved / score-saved).
      // Aux-family callers pass a lower `scrimZClassName` (e.g. z-[55]) to
      // stay UNDER the dock while covering their z-50 sheet.
      className={`candy-modal-scrim pointer-events-auto fixed inset-0 ${scrimZClassName} flex items-center justify-center animate-in fade-in duration-300`}
      role={role}
      aria-modal="true"
      aria-label={ariaLabel}
      aria-live={ariaLive}
      onClick={handleBackdropClick}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={`relative mx-4 w-full max-w-[340px] max-h-[92dvh] overflow-y-auto overscroll-contain ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundImage: panelBackgroundImage,
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

  if (portal && typeof document !== "undefined") {
    return createPortal(scrim, document.body);
  }
  return scrim;
}
