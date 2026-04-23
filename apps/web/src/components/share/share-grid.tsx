"use client";

import { useState, type ReactNode } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { SHARE_COPY } from "@/lib/content/editorial";

type Props = {
  /** Text to share (typically a challenge/achievement sentence). */
  text: string;
  /** URL to share (falls back to SHARE_COPY.url). */
  url?: string;
};

type Service = {
  key: string;
  label: string;
  background: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void | Promise<void>;
};

/**
 * ShareGrid — colorful per-service share icons + native "More" + copy.
 *
 * Replaces the monochrome warm-brown share strip with the Duolingo-style
 * grid: WhatsApp / Messages / Facebook / X / Copy / More. Direct-link
 * services (WhatsApp/Messages/FB/X) open a share URL in a new tab.
 * "More" calls navigator.share() to trigger the OS native picker
 * (covers Messenger, Instagram, Telegram, etc.). "Copy" puts the text
 * on the clipboard with a toast.
 */
export function ShareGrid({ text, url }: Props) {
  const shareUrl = url ?? SHARE_COPY.url;
  const payload = `${text}\n${shareUrl}`;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* silent */ }
  }

  async function handleNativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text, url: shareUrl });
      } catch { /* user cancelled */ }
      return;
    }
    void handleCopy();
  }

  const services: Service[] = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      background: "#25D366",
      href: `https://wa.me/?text=${encodeURIComponent(payload)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
    },
    {
      key: "sms",
      label: "Messages",
      background: "linear-gradient(135deg, #5BD575 0%, #34C759 100%)",
      href: `sms:?&body=${encodeURIComponent(payload)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.04 2 11c0 2.52 1.16 4.8 3 6.43V22l3.75-2.06c1 .27 2.07.43 3.25.43 5.52 0 10-4.04 10-9s-4.48-9-10-9" />
        </svg>
      ),
    },
    {
      key: "facebook",
      label: "Facebook",
      background: "#1877F2",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(text)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073" />
        </svg>
      ),
    },
    {
      key: "x",
      label: "X",
      background: "#0f0f0f",
      href: `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      key: "copy",
      label: copied ? SHARE_COPY.fallbackCopied : "Copy",
      background: "rgba(110, 65, 15, 0.18)",
      onClick: handleCopy,
      icon: <CandyIcon name="copy" className="h-5 w-5" />,
    },
    {
      key: "more",
      label: "More",
      background: "rgba(110, 65, 15, 0.18)",
      onClick: handleNativeShare,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <circle cx="5" cy="12" r="2" fill="rgba(110,65,15,0.85)" />
          <circle cx="12" cy="12" r="2" fill="rgba(110,65,15,0.85)" />
          <circle cx="19" cy="12" r="2" fill="rgba(110,65,15,0.85)" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid w-full grid-cols-4 gap-3">
      {services.map((s) => {
        const body = (
          <>
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-90"
              style={{
                background: s.background,
                boxShadow:
                  "0 4px 10px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.25)",
              }}
            >
              {s.icon}
            </span>
            <span
              className="text-[0.65rem] font-semibold"
              style={{
                color: "rgba(110, 65, 15, 0.80)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              }}
            >
              {s.label}
            </span>
          </>
        );
        if (s.href) {
          return (
            <a
              key={s.key}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Share on ${s.label}`}
              className="flex flex-col items-center gap-1.5"
            >
              {body}
            </a>
          );
        }
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => void s.onClick?.()}
            aria-label={s.label}
            className="flex flex-col items-center gap-1.5"
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
