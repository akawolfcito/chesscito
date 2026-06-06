import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { victoryAbi } from "@/lib/contracts/victory";
import { DIFFICULTY_LABELS } from "@/lib/content/editorial";
import { formatTime } from "@/lib/game/arena-utils";
import {
  VictoryLandingCard,
  type VictoryLandingInfo,
} from "@/components/victory/victory-landing-card";

/** Arena difficulty values (1–3) represent checkmate victories */
const ARENA_DIFFICULTIES = new Set([1, 2, 3]);

type VictoryInfo = VictoryLandingInfo;

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
  return <VictoryLandingCard v={v} />;
}
