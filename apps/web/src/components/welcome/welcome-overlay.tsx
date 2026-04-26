"use client";

import { useEffect, useState } from "react";
import { CandyIcon, type CandyIconName } from "@/components/redesign/candy-icon";
import {
  dismissWelcome,
  isWelcomeDismissed,
} from "@/lib/welcome/state";

type Card = {
  icon: CandyIconName;
  title: string;
  body: string;
};

const CARDS: Card[] = [
  {
    icon: "coach",
    title: "Aprendes piezas con retos cortos",
    body: "Cada pieza vive en niveles. Aprende, explora, domina — minutos al día, sin presión.",
  },
  {
    icon: "trophy",
    title: "Subes a Arena con la IA",
    body: "Cuando dominas piezas, el ajedrez completo se desbloquea solo. Tres niveles de dificultad.",
  },
  {
    icon: "crown",
    title: "Ganas trofeos on-chain",
    body: "Tus victorias quedan registradas en Celo. Tu progreso es tuyo, verificable, para siempre.",
  },
];

/**
 * WelcomeOverlay — first-run 3-card onboarding shown once per
 * device. Auto-mounts only when the welcome flag is unset, so
 * existing players never see it. Card progression is button-based
 * (Continuar / Empezar) so it reads on any input device — no swipe
 * gesture required.
 */
export function WelcomeOverlay() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isWelcomeDismissed()) setOpen(true);
  }, []);

  if (!open) return null;
  const card = CARDS[index];
  const isLast = index === CARDS.length - 1;

  function handleNext() {
    if (isLast) {
      dismissWelcome();
      setOpen(false);
      return;
    }
    setIndex((i) => i + 1);
  }

  function handleSkip() {
    dismissWelcome();
    setOpen(false);
  }

  return (
    <div
      data-testid="welcome-overlay"
      className="candy-modal-scrim fixed inset-0 z-[70] flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-card-title"
    >
      <div
        className="candy-frame candy-frame-amber flex w-full max-w-[340px] flex-col items-center gap-4 px-5 py-6 text-center"
      >
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background: "rgba(245, 158, 11, 0.22)",
            border: "1px solid rgba(245, 158, 11, 0.55)",
          }}
          aria-hidden="true"
        >
          <CandyIcon name={card.icon} className="h-9 w-9" />
        </span>

        <h2
          id="welcome-card-title"
          className="fantasy-title text-lg font-extrabold leading-tight"
        >
          {card.title}
        </h2>
        <p className="text-sm leading-relaxed opacity-85">{card.body}</p>

        {/* Dots indicator */}
        <div className="flex gap-1.5 pt-1" aria-hidden="true">
          {CARDS.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === index ? "1.25rem" : "0.5rem",
                background:
                  i === index
                    ? "rgba(63, 34, 8, 0.85)"
                    : "rgba(63, 34, 8, 0.30)",
              }}
            />
          ))}
        </div>

        <div className="mt-1 flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={handleNext}
            data-testid="welcome-next"
            className="rounded-full px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide"
            style={{
              background: "rgba(63, 34, 8, 0.92)",
              color: "rgba(255, 245, 215, 0.98)",
              boxShadow: "inset 0 1px 0 rgba(255, 245, 215, 0.18)",
            }}
          >
            {isLast ? "Empezar a jugar" : "Continuar"}
          </button>
          {!isLast && (
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs font-bold underline-offset-4 opacity-70 hover:underline"
            >
              Saltar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
