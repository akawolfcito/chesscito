"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { ABOUT_COPY } from "@/lib/content/editorial";
import { hapticSuccess } from "@/lib/haptics";

export function InviteLink() {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        if (navigator.share) {
          void navigator.share({
            title: ABOUT_COPY.shareTitle,
            text: ABOUT_COPY.shareText,
            url: ABOUT_COPY.shareUrl,
          });
        } else {
          void navigator.clipboard.writeText(ABOUT_COPY.shareUrl).then(() => {
            hapticSuccess();
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }
      }}
      className="flex min-h-[44px] w-full items-center gap-3 rounded-xl bg-[var(--link-row-bg)] px-4 py-3 text-cyan-100 transition hover:bg-[var(--link-row-bg-hover)]"
    >
      {copied ? (
        <CandyIcon name="check" className="h-5 w-5 shrink-0 animate-bounce" />
      ) : (
        <Share2 size={18} className="shrink-0 text-cyan-400" />
      )}
      <span className="text-sm font-medium">
        {copied ? ABOUT_COPY.clipboardFeedback : ABOUT_COPY.links.invite}
      </span>
    </button>
  );
}
