"use client";

export default function VictoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[var(--app-max-width)] flex-col items-center justify-center gap-4 bg-[var(--surface-frosted-solid)] px-6 text-center">
      <picture>
        <source srcSet="/art/favicon-wolf.avif" type="image/avif" />
        <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
        <img
          src="/art/favicon-wolf.png"
          alt=""
          aria-hidden="true"
          className="h-16 w-16 rounded-full opacity-60"
        />
      </picture>
      <h2 className="text-xl font-bold text-cyan-50">Could not load victory</h2>
      <p className="text-sm text-cyan-100/60">
        {error.message || "Something went wrong loading this victory."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500"
      >
        Try again
      </button>
    </div>
  );
}
