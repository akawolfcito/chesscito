"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

type SoftGate = {
  onLearn: () => void;
  onDismiss: () => void;
};

type Props = {
  /** When defined, the modal renders open. When undefined, the modal
   *  is collapsed — same control surface as the previous inline
   *  `softGate?` prop on `<ArenaSelectScaffold>`, so callers don't
   *  change how they trigger the gate. */
  softGate?: SoftGate;
};

const FADE_MS = 300;

/**
 * Modal version of the /arena "Want a warm-up first?" gate, adopting the
 * MISSION-detail visual family (forest-frame panel + cream interior +
 * adorno divider + red close X) so the warm-up choice reads as the
 * same room as the other game modals. Replaces the previous bottom-
 * sheet implementation.
 *
 * Behavior preserved:
 *   - Two CTAs (Learn first → onLearn; Enter anyway → onDismiss).
 *   - Esc / backdrop click fires `onDismiss` — matches the "Enter
 *     anyway" path so a user who taps elsewhere proceeds into Arena
 *     rather than being trapped.
 *   - No `?fresh=1` handling here — the parent owns the URL.
 */
export function SoftGateSheet({ softGate }: Props) {
  const t = useTranslations("ARENA_COPY");
  const open = Boolean(softGate);

  const [mounted, setMounted] = useState(open);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setExiting(false);
      return;
    }
    if (!mounted) return;
    setExiting(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setExiting(false);
    }, FADE_MS);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") softGate?.onDismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, softGate]);

  if (!mounted) return null;

  const modal = (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center candy-modal-scrim transition-opacity duration-300 ${
        exiting ? "opacity-0" : "animate-in fade-in duration-300"
      }`}
      aria-modal="true"
      role="dialog"
      aria-labelledby="soft-gate-modal-title"
      onClick={() => softGate?.onDismiss()}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={`relative mx-4 w-full max-w-[340px] max-h-[92dvh] overflow-y-auto overscroll-contain transition-opacity duration-300 ${
          exiting ? "opacity-0" : "animate-in fade-in duration-300"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative w-full"
          style={{
            backgroundImage:
              'image-set(url("/art/screen-mission/panel-mision-icon.avif") type("image/avif"), url("/art/screen-mission/panel-mision-icon.webp") type("image/webp"), url("/art/screen-mission/panel-mision-icon.png") type("image/png"))',
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
          }}
        >
          <button
            type="button"
            onClick={() => softGate?.onDismiss()}
            aria-label={t("softGateRegionLabel")}
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

          <div className="flex flex-col items-center px-[10%] pt-[6%] pb-[5%]">
            <div className="flex w-full items-center">
              <h2
                id="soft-gate-modal-title"
                className="fantasy-title text-2xl font-extrabold tracking-wide"
                style={{
                  color: "var(--popup-title-color)",
                  textShadow: "var(--popup-title-text-shadow)",
                }}
              >
                {t("softGateModalTitle").toUpperCase()}
              </h2>
            </div>

            <div className="mt-3 flex w-full items-center gap-3">
              <picture className="shrink-0">
                <source
                  srcSet="/art/screen-mission/avatar-icon.avif"
                  type="image/avif"
                />
                <source
                  srcSet="/art/screen-mission/avatar-icon.webp"
                  type="image/webp"
                />
                <img
                  src="/art/screen-mission/avatar-icon.png"
                  alt=""
                  aria-hidden="true"
                  className="h-20 w-20 object-contain drop-shadow-[0_3px_10px_rgba(120,65,5,0.45)]"
                  draggable={false}
                />
              </picture>
              <div className="min-w-0 flex-1">
                <p
                  className="text-left text-base font-extrabold leading-tight"
                  style={{
                    color: "rgba(63, 34, 8, 0.95)",
                    textShadow: "0 1px 0 rgba(255, 245, 215, 0.7)",
                  }}
                >
                  {t("softGateTitle")}
                </p>
                <p
                  className="mt-1 text-left text-xs font-medium leading-snug"
                  style={{
                    color: "rgba(110, 65, 15, 0.75)",
                    textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                  }}
                >
                  {t("softGateBody")}
                </p>
              </div>
            </div>

            <picture>
              <source
                srcSet="/art/screen-mission/adorno-icon.avif"
                type="image/avif"
              />
              <source
                srcSet="/art/screen-mission/adorno-icon.webp"
                type="image/webp"
              />
              <img
                src="/art/screen-mission/adorno-icon.png"
                alt=""
                aria-hidden="true"
                className="mt-4 h-4 w-44 object-contain"
                draggable={false}
              />
            </picture>

            <div
              role="region"
              aria-label={t("softGateRegionLabel")}
              data-component="soft-gate-sheet"
              className="mt-4 flex w-full flex-col gap-2"
            >
              <button
                type="button"
                onClick={() => softGate?.onLearn()}
                aria-label={t("softGateLearn")}
                className="arena-scaffold-soft-gate-primary"
              >
                {t("softGateLearn")}
              </button>
              <button
                type="button"
                onClick={() => softGate?.onDismiss()}
                className="arena-scaffold-soft-gate-secondary"
              >
                {t("softGateEnter")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modal, document.body)
    : null;
}
