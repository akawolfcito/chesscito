import type { Metadata } from "next";
import { getDailyTactic } from "@/lib/daily/daily-puzzles";
import { todayUtc } from "@/lib/daily/progress";
import { getShareOrigin } from "@/lib/og/share-urls";
import { posToString } from "@/lib/game/notation";
import { ChallengeDailyClient } from "./challenge-daily-client";

type SearchParams = { date?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function resolveDate(raw: string | undefined): string {
  return raw && DATE_RE.test(raw) ? raw : todayUtc();
}

function buildOgImageUrl(
  origin: string,
  puzzle: ReturnType<typeof getDailyTactic>,
  startAlg: string,
  targetAlg: string,
): string {
  const params = new URLSearchParams({
    type: "daily",
    piece: puzzle.piece,
    name: puzzle.name,
    start: startAlg,
    target: targetAlg,
  });
  return `${origin}/api/og/exercise?${params.toString()}`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const date = resolveDate(searchParams.date);
  const puzzle = getDailyTactic(date);
  const origin = getShareOrigin();
  const startAlg = posToString(puzzle.exercise.startPos);
  const targetAlg = posToString(puzzle.exercise.targetPos);

  const title = "Daily Challenge · Chesscito";
  const description = `Can you solve today's ${puzzle.piece} puzzle? ${puzzle.name}`;
  const ogImage = buildOgImageUrl(origin, puzzle, startAlg, targetAlg);
  const canonical = `${origin}/challenge/daily?date=${date}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
          type: "image/jpeg",
        },
      ],
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

export default function ChallengeDailyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const today = resolveDate(searchParams.date);
  const puzzle = getDailyTactic(today);
  return <ChallengeDailyClient puzzleData={puzzle} today={today} />;
}
