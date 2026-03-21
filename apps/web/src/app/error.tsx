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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <picture>
        <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
        <img
          src="/art/favicon-wolf.png"
          alt=""
          aria-hidden="true"
          className="h-16 w-16 rounded-full opacity-60"
        />
      </picture>
      <h2 className="text-xl font-bold text-cyan-50">{ERROR_PAGE_COPY.boardCrashed}</h2>
      <p className="text-sm text-cyan-100/60">
        {error.message || ERROR_PAGE_COPY.gameFallback}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500"
      >
        {ERROR_PAGE_COPY.reloadGame}
      </button>
    </div>
  );
}
