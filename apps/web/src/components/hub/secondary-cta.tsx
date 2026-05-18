"use client";
import { SECONDARY_CTA_COPY } from "@/lib/content/editorial";

type Props = { onPress: () => void };

export function SecondaryCta({ onPress }: Props) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={SECONDARY_CTA_COPY.arena.ariaLabel}
      className="hub-secondary-cta"
    >
      {SECONDARY_CTA_COPY.arena.label} <span aria-hidden="true">→</span>
    </button>
  );
}
