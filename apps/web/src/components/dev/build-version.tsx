"use client";

/**
 * Visible build-identity pill (git short SHA). Surfaces the deploy
 * version so smoke-testers can confirm "the new code is loaded" —
 * closes the trust gap after a deploy where the user couldn't tell
 * whether their session was hitting the freshly-shipped bundle or
 * a cached one.
 *
 * Wired through next.config.js → env.NEXT_PUBLIC_BUILD_SHA, populated
 * by Vercel's VERCEL_GIT_COMMIT_SHA at build time. Falls back to
 * "dev" locally.
 *
 * Visual: high-contrast pill that reads on any background (dark
 * arena, candy hub, paper modals). Pinned bottom-right via the
 * template wrapper.
 */
export function BuildVersion() {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA || "dev";
  return (
    <span
      data-testid="build-version"
      aria-label={`Build ${sha}`}
      className="rounded-full px-2 py-0.5 text-[10px] font-mono font-bold"
      style={{
        background: "rgba(0, 0, 0, 0.55)",
        color: "rgba(255, 215, 0, 0.95)",
        border: "1px solid rgba(255, 215, 0, 0.45)",
        textShadow: "0 1px 0 rgba(0, 0, 0, 0.55)",
      }}
    >
      v.{sha}
    </span>
  );
}
