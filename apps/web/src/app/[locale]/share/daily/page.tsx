import type { Metadata } from "next";
import Link from "next/link";
import { DAILY_SHARE_COPY, PIECE_LABELS } from "@/lib/content/editorial";
import {
  SHARE_PIECES,
  getShareOrigin,
  type SharePiece,
} from "@/lib/og/share-urls";

type SearchParams = {
  piece?: string;
  name?: string;
  start?: string;
  target?: string;
  solved?: string;
  streak?: string;
};

type DailyParams = {
  piece: SharePiece;
  name: string;
  start: string;
  target: string;
  solved: boolean;
  streak: number;
};

const SQUARE_RE = /^[a-h][1-8]$/;
const NAME_MAX = 40;
const STREAK_MAX = 999;

function normalize(searchParams: SearchParams): DailyParams {
  const rawPiece = (searchParams.piece ?? "").toLowerCase();
  const piece = (SHARE_PIECES as readonly string[]).includes(rawPiece)
    ? (rawPiece as SharePiece)
    : "rook";
  const name = (searchParams.name ?? "Daily Tactic").slice(0, NAME_MAX);
  const rawStart = (searchParams.start ?? "").toLowerCase();
  const start = SQUARE_RE.test(rawStart) ? rawStart : "a1";
  const rawTarget = (searchParams.target ?? "").toLowerCase();
  const target = SQUARE_RE.test(rawTarget) ? rawTarget : "a1";
  const solved = searchParams.solved === "true";
  const rawStreak = Number.parseInt(searchParams.streak ?? "", 10);
  const streak = Number.isFinite(rawStreak)
    ? Math.min(Math.max(rawStreak, 0), STREAK_MAX)
    : 0;
  return { piece, name, start, target, solved, streak };
}

function buildOgImage(origin: string, p: DailyParams): string {
  const params = new URLSearchParams({
    type: "daily",
    piece: p.piece,
    name: p.name,
    start: p.start,
    target: p.target,
  });
  if (p.solved) {
    params.set("solved", "true");
    if (p.streak > 0) params.set("streak", String(p.streak));
  }
  return `${origin}/api/og/exercise?${params.toString()}`;
}

function buildCanonical(origin: string, p: DailyParams): string {
  const params = new URLSearchParams({
    piece: p.piece,
    name: p.name,
    start: p.start,
    target: p.target,
  });
  if (p.solved) {
    params.set("solved", "true");
    if (p.streak > 0) params.set("streak", String(p.streak));
  }
  return `${origin}/share/daily?${params.toString()}`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = normalize(searchParams);
  const origin = getShareOrigin();
  const title = params.solved
    ? "Daily Tactic solved — Chesscito"
    : "Daily Tactic — Chesscito";
  const description = params.solved
    ? DAILY_SHARE_COPY.ctaSolved(params.streak > 0 ? params.streak : undefined)
    : DAILY_SHARE_COPY.ctaChallenge;
  const ogImage = buildOgImage(origin, params);
  const canonical = buildCanonical(origin, params);

  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title, type: "image/jpeg" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function ShareDailyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = normalize(searchParams);
  const pieceLabel = PIECE_LABELS[params.piece];
  const headline = params.solved ? "Daily Tactic solved" : "Daily Tactic";
  const subhead = params.solved
    ? DAILY_SHARE_COPY.ctaSolved(params.streak > 0 ? params.streak : undefined)
    : DAILY_SHARE_COPY.ctaChallenge;

  return (
    <main className="mission-shell secondary-page-scrim flex min-h-[100dvh] items-center justify-center px-6">
      <div
        className="candy-page-panel flex w-full max-w-[var(--app-max-width)] flex-col items-center gap-4 rounded-3xl px-6 py-10 text-center"
        style={{ background: "var(--paper-bg)" }}
      >
        <p
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "rgba(110, 65, 15, 0.55)" }}
        >
          {pieceLabel} · {params.name}
        </p>
        <p
          className="fantasy-title text-3xl font-bold"
          style={{ color: "rgba(110, 65, 15, 0.98)" }}
        >
          {headline}
        </p>
        <p
          className="text-sm leading-snug"
          style={{ color: "rgba(110, 65, 15, 0.75)" }}
        >
          {subhead}
        </p>
        <Link
          href="/play-hub"
          className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-full px-6 text-sm font-bold"
          style={{
            background: "rgba(245, 158, 11, 0.95)",
            color: "rgba(63, 34, 8, 0.95)",
            boxShadow: "0 4px 12px rgba(120, 65, 5, 0.32)",
          }}
        >
          Play Chesscito
        </Link>
      </div>
    </main>
  );
}
