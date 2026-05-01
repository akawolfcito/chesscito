import { COGNITIVE_DISCLAIMER_COPY } from "@/lib/content/editorial";

type CognitiveDisclaimerProps = {
  variant?: "short" | "full";
  className?: string;
};

/** Compact in-app cognitive disclaimer rendered above the dock on
 *  surfaces that frame Chesscito as a cognitive-practice product
 *  (play-hub, arena). The landing and /about pages render the longer
 *  `full` variant; in-game contexts use `short` so it fits between
 *  the gameplay zone and the dock without competing for attention.
 *
 *  Style intent: visually secondary (cream text on whatever bg the
 *  parent provides), centered, low contrast, no border, no icon.
 *  Should read as a footnote, never as a warning banner. */
export function CognitiveDisclaimer({
  variant = "short",
  className = "",
}: CognitiveDisclaimerProps) {
  const text =
    variant === "full"
      ? COGNITIVE_DISCLAIMER_COPY.full
      : COGNITIVE_DISCLAIMER_COPY.short;

  return (
    <p
      role="note"
      aria-label="Cognitive disclaimer"
      className={`px-4 pt-2 pb-1 text-center text-[11px] leading-snug ${className}`}
      style={{
        color: "rgba(255, 245, 215, 0.65)",
        textShadow: "0 1px 2px rgba(0, 0, 0, 0.45)",
      }}
    >
      {text}
    </p>
  );
}
