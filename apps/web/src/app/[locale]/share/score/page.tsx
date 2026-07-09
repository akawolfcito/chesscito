import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import {
  SHARE_PIECES,
  clampMaxStars,
  getShareOrigin,
  type SharePiece,
} from "@/lib/og/share-urls";

type SearchParams = { piece?: string; stars?: string; max?: string };

function normalize(
  searchParams: SearchParams,
): { piece: SharePiece; stars: number; maxStars: number } {
  const rawPiece = (searchParams.piece ?? "").toLowerCase();
  const piece = (SHARE_PIECES as readonly string[]).includes(rawPiece)
    ? (rawPiece as SharePiece)
    : "rook";
  const rawMax = Number.parseInt(searchParams.max ?? "", 10);
  const maxStars = clampMaxStars(Number.isFinite(rawMax) ? rawMax : undefined);
  const rawStars = Number.parseInt(searchParams.stars ?? "", 10);
  const stars = Number.isFinite(rawStars)
    ? Math.min(Math.max(rawStars, 0), maxStars)
    : 0;
  return { piece, stars, maxStars };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { piece, stars, maxStars } = normalize(searchParams);
  const tScore = await getTranslations("SCORE_SHARE_COPY");
  const tShare = await getTranslations("SHARE_COPY");
  const origin = getShareOrigin();
  const title = tScore("metaTitleFormat", { stars });
  const description = tShare("score", { stars });
  // Slice A: leaderboard-first score card (was type=piece-complete, which
  // rendered the "{Piece} Mastered" art on a score share).
  const ogImage = `${origin}/api/og/exercise?piece=${piece}&stars=${stars}&max=${maxStars}&type=score-saved`;
  const canonical = `${origin}/share/score?piece=${piece}&stars=${stars}&max=${maxStars}`;

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

export default async function ShareScorePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { piece, stars } = normalize(searchParams);
  const tPiece = await getTranslations("PIECE_LABELS");
  const tScore = await getTranslations("SCORE_SHARE_COPY");
  const tShare = await getTranslations("SHARE_COPY");
  const pieceLabel = tPiece(piece);

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
          {tScore("kickerFormat", { piece: pieceLabel })}
        </p>
        <p
          className="fantasy-title text-3xl font-bold"
          style={{ color: "rgba(110, 65, 15, 0.98)" }}
        >
          {tScore("headlineFormat", { stars })}
        </p>
        <p
          className="text-sm leading-snug"
          style={{ color: "rgba(110, 65, 15, 0.75)" }}
        >
          {tShare("score", { stars })}
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
          {tShare("playCta")}
        </Link>
      </div>
    </main>
  );
}
