"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { hapticSuccess } from "@/lib/haptics";

export function InviteLink() {
  const [copied, setCopied] = useState(false);
  const t = useTranslations("ABOUT_COPY");

  return (
    <button
      type="button"
      onClick={() => {
        if (navigator.share) {
          void navigator.share({
            title: t("shareTitle"),
            text: t("shareText"),
            url: t("shareUrl"),
          });
        } else {
          void navigator.clipboard.writeText(t("shareUrl")).then(() => {
            hapticSuccess();
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }
      }}
      className="paper-tray flex min-h-[44px] w-full items-center gap-3 transition active:scale-[0.99]"
      style={{ color: "var(--paper-text)" }}
    >
      {copied ? (
        <CandyIcon name="check" className="h-5 w-5 shrink-0 animate-bounce" />
      ) : (
        <CandyIcon name="share" className="h-5 w-5 shrink-0" />
      )}
      <span className="text-sm font-medium">
        {copied ? t("clipboardFeedback") : t("links.invite")}
      </span>
    </button>
  );
}
