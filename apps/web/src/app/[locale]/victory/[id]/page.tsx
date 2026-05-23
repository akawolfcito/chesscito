import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { victoryAbi } from "@/lib/contracts/victory";
import { DIFFICULTY_LABELS } from "@/lib/content/editorial";
import { formatTime } from "@/lib/game/arena-utils";
import { VictoryTrophy } from "./victory-trophy";
import { AcceptChallengeButton } from "./accept-challenge-button";

/** Arena difficulty values (1–3) represent checkmate victories */
const ARENA_DIFFICULTIES = new Set([1, 2, 3]);

type VictoryInfo = {
  id: string;
  moves: number;
  timeMs: number;
  difficulty: string;
  difficultyRaw: number;
};

async function fetchVictory(id: string): Promise<VictoryInfo | null> {
  const contractAddress = process.env.NEXT_PUBLIC_VICTORY_NFT_ADDRESS as `0x${string}` | undefined;
  if (!contractAddress) return null;

  try {
    const client = createPublicClient({ chain: celo, transport: http() });
    const tokenId = BigInt(id);

    const victoryData = await client.readContract({
      address: contractAddress,
      abi: victoryAbi,
      functionName: "victories",
      args: [tokenId],
    });

    const [diff, totalMoves, timeMs] = victoryData as [number, number, number];

    return {
      id,
      moves: totalMoves,
      timeMs,
      difficulty: DIFFICULTY_LABELS[diff] ?? "Easy",
      difficultyRaw: diff,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const v = await fetchVictory(params.id);
  const t = await getTranslations("VICTORY_PAGE_COPY");

  const isCheckmate = v ? ARENA_DIFFICULTIES.has(v.difficultyRaw) : false;
  const title = v
    ? (isCheckmate
        ? t("metaCheckmate", { moves: v.moves })
        : t("metaComplete", { moves: v.moves }))
    : t("metaFallbackTitle", { id: params.id });
  const description = v
    ? `${t("metaChallenge", { id: params.id })} ${v.difficulty} • ${formatTime(v.timeMs)}`
    : t("metaFallback");

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://chesscito.com");

  const ogImage = `${baseUrl}/api/og/victory/${params.id}`;
  const url = `${baseUrl}/victory/${params.id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
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

export default async function VictoryPage({ params }: { params: { id: string } }) {
  const v = await fetchVictory(params.id);
  if (!v) notFound();
  const t = await getTranslations("VICTORY_PAGE_COPY");

  return (
    <main
      className="mission-shell secondary-page-scrim flex min-h-[100dvh] justify-center animate-in fade-in duration-500"
    >
      <div
        className="candy-page-panel flex w-full max-w-[var(--app-max-width)] flex-col items-center rounded-t-3xl px-6 pb-8 pt-12 animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ background: "var(--paper-bg)" }}
      >
        {/* Trophy spotlight — warm amber glow behind the trophy */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-48"
          style={{
            background:
              "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(245, 158, 11, 0.28) 0%, rgba(245, 158, 11, 0) 70%)",
          }}
        />

        <div className="relative z-10">
          <VictoryTrophy />
        </div>

        <h1
          className="fantasy-title relative z-10 mb-2 mt-2 text-3xl font-bold text-center"
          style={{
            color: "rgba(110, 65, 15, 0.98)",
            textShadow:
              "0 1px 0 rgba(255, 245, 215, 0.80), 0 2px 6px rgba(120, 65, 5, 0.35)",
          }}
        >
          {ARENA_DIFFICULTIES.has(v.difficultyRaw)
            ? t("metaCheckmate", { moves: v.moves })
            : t("metaComplete", { moves: v.moves })}
        </h1>

        <div
          className="relative z-10 mb-3 flex gap-3 text-sm font-semibold"
          style={{ color: "rgba(110, 65, 15, 0.80)" }}
        >
          <span>{v.difficulty}</span>
          <span>•</span>
          <span>{formatTime(v.timeMs)}</span>
        </div>

        <p
          className="relative z-10 mb-4 text-center text-xs"
          style={{ color: "rgba(110, 65, 15, 0.65)" }}
        >
          {t("tagline")}
        </p>

        <p
          className="relative z-10 mb-8 text-lg font-extrabold text-center"
          style={{
            color: "rgba(120, 65, 5, 0.95)",
            textShadow: "0 1px 0 rgba(255, 245, 215, 0.70)",
          }}
        >
          {t("challengeLine")}
        </p>

        <div className="relative z-10 flex w-full justify-center">
          <AcceptChallengeButton />
        </div>

        <Link
          href="/hub"
          className="relative z-10 mt-3 flex min-h-[44px] items-center px-3 text-sm font-semibold underline underline-offset-2 transition-colors hover:opacity-80"
          style={{ color: "rgba(110, 65, 15, 0.70)" }}
        >
          {t("backToHub")}
        </Link>
      </div>
    </main>
  );
}
