"use client";

import { ERROR_PAGE_COPY } from "@/lib/content/editorial";

export default function PlayHubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,250,235,1) 0%, rgba(250,240,210,1) 55%, rgba(240,225,185,1) 100%)",
      }}
    >
      <picture>
        <source srcSet="/art/favicon-wolf.avif" type="image/avif" />
        <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
        <img
          src="/art/favicon-wolf.png"
          alt=""
          aria-hidden="true"
          className="h-16 w-16 rounded-full opacity-80 drop-shadow-[0_4px_12px_rgba(120,65,5,0.35)]"
        />
      </picture>
      <h2
        className="fantasy-title text-xl font-bold"
        style={{
          color: "rgba(110, 65, 15, 0.95)",
          textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
        }}
      >
        {ERROR_PAGE_COPY.boardCrashed}
      </h2>
      <p
        className="text-sm"
        style={{
          color: "rgba(110, 65, 15, 0.75)",
          textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
        }}
      >
        {error.message || ERROR_PAGE_COPY.gameFallback}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl px-6 py-3 text-sm font-semibold transition active:scale-[0.97]"
        style={{
          background: "rgb(120, 65, 5)",
          color: "rgb(255, 240, 180)",
          boxShadow: "0 3px 8px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
        }}
      >
        {ERROR_PAGE_COPY.reloadGame}
      </button>
    </div>
  );
}
