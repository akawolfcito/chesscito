"use client";

import { useState } from "react";
import { INVITE_COPY } from "@/lib/content/editorial";
import { ShareModal } from "@/components/share/share-modal";

export function InviteButton() {
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
        cardUrl="/api/og/invite"
        text={INVITE_COPY.text}
        url={INVITE_COPY.url}
        title={INVITE_COPY.button}
      />
    </>
  );
}
