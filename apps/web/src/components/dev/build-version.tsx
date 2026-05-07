"use client";

/**
 * Tiny chip that surfaces the build identity (git short SHA) so smoke-
 * testers can confirm "the new code is loaded" — closes the trust gap
 * after a deploy where the user couldn't tell whether their session
 * was hitting the freshly-shipped bundle or a cached old one.
 *
 * Wired through next.config.js → env.NEXT_PUBLIC_BUILD_SHA, populated
 * by Vercel's VERCEL_GIT_COMMIT_SHA at build time. Falls back to
 * "dev" locally.
 */
export function BuildVersion() {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA || "dev";
  return (
    <span
      data-testid="build-version"
      aria-label={`Build ${sha}`}
      className="text-nano font-mono opacity-50"
      style={{ color: "rgba(110, 65, 15, 0.55)" }}
    >
      v.{sha}
    </span>
  );
}
