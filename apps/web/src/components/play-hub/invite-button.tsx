"use client";

import { useState } from "react";
import { INVITE_COPY } from "@/lib/content/editorial";
import { ShareModal } from "@/components/share/share-modal";

type Props = {
  /** Override the default invite card URL with a context-aware one
   *  (e.g. `/api/og/invite?piece=rook&fen=...`). Falls back to the
   *  generic `/api/og/invite` card when omitted. */
  cardUrl?: string;
  /** Override the share text; defaults to INVITE_COPY.text. */
  text?: string;
  /** Override the share URL; defaults to INVITE_COPY.url. */
  url?: string;
};

export function InviteButton({ cardUrl, text, url }: Props = {}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={INVITE_COPY.button}
        onClick={() => setOpen(true)}
        className="relative flex shrink-0 items-center justify-center text-cyan-100/70"
      >
        <img
          src="/art/invite-share-menu.png"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
        />
        <span className="sr-only">{INVITE_COPY.button}</span>
      </button>

      <ShareModal
        open={open}
        onOpenChange={setOpen}
        cardUrl={cardUrl ?? "/api/og/invite"}
        text={text ?? INVITE_COPY.text}
        url={url ?? INVITE_COPY.url}
        title={INVITE_COPY.button}
      />
    </>
  );
}
