"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { track } from "@/lib/telemetry";
import { isMiniPayEnv } from "@/lib/minipay";

type Props = {
  /** Text to share (typically a challenge/achievement sentence). */
  text: string;
  /** URL to share (falls back to SHARE_COPY.url). */
  url?: string;
  /** Relative or absolute URL to the OG card PNG/JPEG. When present
   *  the "Copy" tile becomes "Save" (downloads the card image) and
   *  the "More" tile attaches the card image to navigator.share via
   *  the Web Share Level 2 `files` payload — letting the OS picker
   *  forward the actual PNG to Messenger / IG / Telegram. */
  cardUrl?: string;
};

type Service = {
  key: string;
  label: string;
  background: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void | Promise<void>;
};

type SaveState = "idle" | "saved" | "link-copied" | "failed";

/**
 * ShareGrid — colorful per-service share icons + native "More" + copy.
 *
 * Renders the Duolingo-style grid: WhatsApp / Telegram / Facebook / X /
 * Save (or Copy) / More. Direct-link services open a share URL in a new
 * tab — all four render OG previews when the share URL points at a
 * canonical /share/* page. "More" calls navigator.share() to trigger the
 * OS native picker (covers Discord, LinkedIn, Slack, etc.). Instagram
 * and TikTok strip OG previews and have no share-via-URL API, so they
 * are reached via Save → manual upload to Story/Reel/Post.
 */
export function ShareGrid({ text, url, cardUrl }: Props) {
  const tGrid = useTranslations("SHARE_GRID_COPY");
  const tShare = useTranslations("SHARE_COPY");
  const shareUrl = url ?? tShare("url");
  // `text` (e.g. challengeText) may already embed the share URL. Every path
  // below ALSO adds the URL (payload, service params, navigator.share url), so
  // strip any URL from the message first to avoid the duplicated-link bug
  // (founder 2026-06-16); the URL is then re-added exactly once per path.
  const textNoUrl = text.replace(/https?:\/\/\S+/gi, "").replace(/\s*👉\s*$/u, "").trimEnd();
  const payload = `${textNoUrl}\n${shareUrl}`;
  const [copied, setCopied] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // Hide the Download/Save tile inside MiniPay: its in-app image viewer renders
  // the card deformed (founder 2026-06-16). Set post-mount to avoid SSR mismatch.
  const [inMiniPay, setInMiniPay] = useState(false);
  useEffect(() => {
    setInMiniPay(isMiniPayEnv());
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(payload);
      track("share_tile_tap", { tile: "copy", success: true });
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      track("share_tile_tap", { tile: "copy", success: false });
    }
  }

  async function fetchCardFile(): Promise<File | null> {
    if (!cardUrl) return null;
    try {
      const res = await fetch(cardUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      const extension = blob.type.includes("png") ? "png" : "jpg";
      return new File([blob], `chesscito-${Date.now()}.${extension}`, { type: blob.type });
    } catch {
      return null;
    }
  }

  async function handleSave() {
    const file = await fetchCardFile();
    if (!file) {
      track("share_tile_tap", { tile: "save", success: false });
      setSaveState("failed");
      setTimeout(() => setSaveState("idle"), 1800);
      return;
    }

    // 1. Native share with file — works reliably in MiniPay / mobile WebView
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        track("share_tile_tap", { tile: "save", path: "native_files" });
        // Native share sheet opened — do NOT claim "Saved".
        // User either completed or cancelled; reset silently.
        return;
      } catch {
        // User cancelled share sheet — fall through to download fallback
      }
    }

    // 2. <a download> fallback — works on desktop
    try {
      const objectUrl = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      track("share_tile_tap", { tile: "save", path: "download", success: true });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1800);
      return;
    } catch {
      // fall through to clipboard
    }

    // 3. Clipboard fallback — copy image URL so user can paste elsewhere
    if (cardUrl) {
      try {
        await navigator.clipboard.writeText(cardUrl);
        track("share_tile_tap", { tile: "save", path: "clipboard", success: true });
        setSaveState("link-copied");
        setTimeout(() => setSaveState("idle"), 1800);
        return;
      } catch {
        // fall through to failure
      }
    }

    track("share_tile_tap", { tile: "save", success: false });
    setSaveState("failed");
    setTimeout(() => setSaveState("idle"), 1800);
  }

  async function handleNativeShare() {
    if (typeof navigator === "undefined" || !navigator.share) {
      track("share_tile_tap", { tile: "more", path: "no_api_fallback_copy" });
      void handleCopy();
      return;
    }
    if (cardUrl) {
      const file = await fetchCardFile();
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: textNoUrl, url: shareUrl });
          track("share_tile_tap", { tile: "more", path: "native_files" });
          return;
        } catch {
          track("share_tile_tap", { tile: "more", path: "native_files_cancelled" });
          return;
        }
      }
    }
    try {
      await navigator.share({ text: textNoUrl, url: shareUrl });
      track("share_tile_tap", { tile: "more", path: "native_text_only" });
    } catch {
      track("share_tile_tap", { tile: "more", path: "native_text_cancelled" });
    }
  }

  const saveLabel = (() => {
    switch (saveState) {
      case "saved": return tGrid("saveSaved");
      case "link-copied": return tGrid("saveLinkCopied");
      case "failed": return tGrid("saveFailed");
      default: return tGrid("save");
    }
  })();

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
      // Telegram renders OG previews and is the preferred social channel
      // in the Celo / MiniPay community. SMS was dropped: paid medium with
      // negligible share-tile telemetry usage in production.
      key: "telegram",
      label: "Telegram",
      background: "linear-gradient(135deg, #37AEE2 0%, #1E96C8 100%)",
      href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(textNoUrl)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden="true">
          <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
        </svg>
      ),
    },
    {
      key: "facebook",
      label: "Facebook",
      background: "#1877F2",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(textNoUrl)}`,
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
      href: `https://x.com/intent/tweet?text=${encodeURIComponent(textNoUrl)}&url=${encodeURIComponent(shareUrl)}`,
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    cardUrl && !inMiniPay
      ? {
          key: "save",
          label: saveLabel,
          background: "rgba(110, 65, 15, 0.18)",
          onClick: handleSave,
          icon: (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="rgba(110,65,15,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          ),
        }
      : {
          key: "copy",
          label: copied ? tShare("fallbackCopied") : tGrid("copy"),
          background: "rgba(110, 65, 15, 0.18)",
          onClick: handleCopy,
          icon: <CandyIcon name="copy" className="h-5 w-5" />,
        },
    {
      key: "more",
      label: tGrid("more"),
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
              aria-label={tGrid("shareOnLabel", { service: s.label })}
              className="flex flex-col items-center gap-1.5"
              onClick={() => track("share_tile_tap", { tile: s.key })}
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
