"use client";

import { Share2 } from "lucide-react";
import { ABOUT_COPY } from "@/lib/content/editorial";

export function InviteLink() {
  return (
    <button
      type="button"
      onClick={() => {
        if (navigator.share) {
          void navigator.share({
            title: "Chesscito",
            text: "Learn chess piece movements with gamified on-chain challenges on Celo.",
            url: "https://chesscito.vercel.app",
          });
        } else {
          void navigator.clipboard.writeText("https://chesscito.vercel.app");
        }
      }}
      className="flex min-h-[44px] w-full items-center gap-3 rounded-xl bg-[var(--link-row-bg)] px-4 py-3 text-cyan-100 transition hover:bg-[var(--link-row-bg-hover)]"
    >
      <Share2 size={18} className="shrink-0 text-cyan-400" />
      <span className="text-sm font-medium">{ABOUT_COPY.links.invite}</span>
    </button>
  );
}
