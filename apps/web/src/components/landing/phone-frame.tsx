import type { ReactNode } from "react";

type PhoneFrameProps = {
  /** Screenshot or any node rendered inside the device chrome. */
  children: ReactNode;
  /** Optional accessible label for the visual. */
  label?: string;
};

/**
 * PhoneFrame — CSS-only mobile device chrome inspired by the
 * Duolingo Chess landing reference. Wraps a 9:19 aspect screenshot
 * in a dark rounded body with a top notch indicator and a bottom
 * home-bar pill. No image assets required.
 *
 * The frame draws on every viewport — same chrome desktop and
 * mobile. Screenshots fit the inner area via a 9:19 aspect-ratio
 * holder, so the wrapped content stays portrait regardless of where
 * the frame is rendered.
 */
export function PhoneFrame({ children, label }: PhoneFrameProps) {
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      className="relative mx-auto w-full max-w-[260px] rounded-[2.5rem] p-2 sm:max-w-[300px]"
      style={{
        background: "linear-gradient(180deg, rgba(40, 22, 8, 0.95) 0%, rgba(20, 12, 4, 0.95) 100%)",
        boxShadow:
          "0 18px 40px rgba(40, 22, 8, 0.35), inset 0 1px 0 rgba(255, 245, 215, 0.18), inset 0 -3px 0 rgba(0, 0, 0, 0.45)",
      }}
    >
      {/* Notch — small pill at the top of the frame */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-3 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full"
        style={{ background: "rgba(0, 0, 0, 0.55)" }}
      />

      {/* Inner screen — 9:19 aspect ratio holder */}
      <div
        className="relative w-full overflow-hidden rounded-[2rem]"
        style={{
          aspectRatio: "9 / 19",
          background: "rgba(255, 245, 215, 0.55)",
        }}
      >
        {children}
      </div>

      {/* Home indicator — soft pill at the bottom edge */}
      <div
        aria-hidden="true"
        className="absolute bottom-2 left-1/2 z-10 h-1 w-20 -translate-x-1/2 rounded-full"
        style={{ background: "rgba(255, 245, 215, 0.40)" }}
      />
    </div>
  );
}
