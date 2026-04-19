"use client";

import { useState } from "react";
import { INVITE_COPY } from "@/lib/content/editorial";

export function InviteButton() {
  const [copied, setCopied] = useState(false);

  async function handleInvite() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: INVITE_COPY.text, url: INVITE_COPY.url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(`${INVITE_COPY.text}\n${INVITE_COPY.url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard also failed — silently ignore
    }
  }

  return (
    <button
      type="button"
      aria-label={INVITE_COPY.button}
      onClick={() => void handleInvite()}
      className="relative flex shrink-0 items-center justify-center text-cyan-100/70"
    >
      <img
        src="/art/invite-share-menu.png"
        alt=""
        aria-hidden="true"
        className="h-full w-full object-contain p-0.5 dock-treat-base"
      />
      <span className="sr-only">{INVITE_COPY.button}</span>
      {copied ? (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white shadow-lg">
          {INVITE_COPY.copied}
        </span>
      ) : null}
    </button>
  );
}
