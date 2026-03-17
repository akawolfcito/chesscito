"use client";

import { useState } from "react";

type Props = {
  text: string;
  url: string;
  label: string;
  copiedLabel?: string;
  variant?: "ghost-cyan" | "amber";
};

export function ShareButton({
  text,
  url,
  label,
  copiedLabel = "Copied!",
  variant = "ghost-cyan",
}: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard also failed — silently ignore
    }
  }

  const baseClass =
    "w-full rounded-2xl px-6 py-2.5 font-semibold transition-all active:scale-95";
  const variantClass =
    variant === "amber"
      ? "bg-gradient-to-r from-amber-500 to-amber-400 text-white shadow-[0_0_16px_rgba(245,158,11,0.3)] hover:shadow-[0_0_24px_rgba(245,158,11,0.5)]"
      : "border border-cyan-400/30 bg-transparent text-cyan-300 hover:bg-cyan-400/10";

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      className={`${baseClass} ${variantClass}`}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
