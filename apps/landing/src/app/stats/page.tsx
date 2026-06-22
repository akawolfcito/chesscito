import type { Metadata } from "next";
import Link from "next/link";

const PLAY_URL = process.env.NEXT_PUBLIC_PLAY_URL ?? "https://lite.chesscito.com";
const FULL_URL = process.env.NEXT_PUBLIC_FULL_URL ?? "https://play.chesscito.com";

export const metadata: Metadata = {
  title: "Stats — Chesscito",
  description: "Activity and progress stats for Chesscito Lite and Chesscito Full.",
};

export default function StatsPage() {
  return (
    <main className="min-h-[100dvh] bg-[var(--paper-bg)] px-5 py-10 md:px-10">
      <div className="mx-auto max-w-[800px]">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-2 transition-opacity hover:opacity-80"
          style={{ color: "rgba(110, 65, 15, 0.75)" }}
        >
          ← Back
        </Link>

        <h1
          className="fantasy-title mb-2 mt-6 text-2xl font-extrabold uppercase tracking-[0.14em] md:text-3xl"
          style={{ color: "var(--landing-text)", textShadow: "var(--landing-text-shadow-soft)" }}
        >
          Stats
        </h1>
        <p
          className="mb-10 text-sm leading-relaxed md:text-base"
          style={{ color: "var(--paper-text-muted)" }}
        >
          Live activity from both products.
        </p>

        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2" role="list">
          {/* Lite */}
          <li
            className="flex flex-col gap-3 rounded-2xl border px-6 py-6"
            style={{
              background: "var(--landing-card-bg)",
              borderColor: "var(--landing-card-border)",
              boxShadow: "inset 0 1px 0 var(--landing-card-shadow-inner)",
            }}
          >
            <span
              className="inline-flex w-fit rounded-full border px-3 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.14em]"
              style={{
                background: "var(--landing-accent-bg)",
                borderColor: "var(--landing-accent-border)",
                color: "var(--landing-text)",
              }}
            >
              Lite
            </span>
            <h2
              className="fantasy-title text-lg font-extrabold"
              style={{ color: "var(--landing-text)", textShadow: "var(--landing-text-shadow)" }}
            >
              Chesscito Lite
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--paper-text-muted)" }}>
              Daily habits, streak data, and exercises completed.
            </p>
            <a
              href={`${PLAY_URL}/stats`}
              className="mt-auto inline-flex min-h-[40px] items-center justify-center rounded-2xl border px-5 text-sm font-extrabold uppercase tracking-[0.10em] transition-opacity hover:opacity-80"
              style={{
                background: "var(--landing-accent-bg)",
                borderColor: "var(--landing-accent-border)",
                color: "var(--landing-text)",
              }}
            >
              View Lite Stats →
            </a>
          </li>

          {/* Full */}
          <li
            className="flex flex-col gap-3 rounded-2xl border px-6 py-6"
            style={{
              background: "var(--landing-card-bg)",
              borderColor: "var(--landing-accent-border)",
              boxShadow:
                "inset 0 1px 0 var(--landing-card-shadow-inner), 0 0 0 2px var(--landing-accent-border)",
            }}
          >
            <span
              className="inline-flex w-fit rounded-full border px-3 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.14em]"
              style={{
                background: "var(--landing-accent-bg-strong)",
                borderColor: "var(--landing-accent-border)",
                color: "var(--landing-text)",
              }}
            >
              Full
            </span>
            <h2
              className="fantasy-title text-lg font-extrabold"
              style={{ color: "var(--landing-text)", textShadow: "var(--landing-text-shadow)" }}
            >
              Chesscito Full
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--paper-text-muted)" }}>
              Arena matches, leaderboard rankings, and achievements.
            </p>
            <a
              href={`${FULL_URL}/stats`}
              className="mt-auto inline-flex min-h-[40px] items-center justify-center rounded-2xl border px-5 text-sm font-extrabold uppercase tracking-[0.10em] transition-opacity hover:opacity-80"
              style={{
                background: "var(--landing-accent-bg-strong)",
                borderColor: "var(--landing-accent-border)",
                color: "var(--landing-text)",
              }}
            >
              View Full Stats →
            </a>
          </li>
        </ul>
      </div>
    </main>
  );
}
