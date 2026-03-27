import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { victoryAbi } from "@/lib/contracts/victory";
import { DIFFICULTY_LABELS, VICTORY_PAGE_COPY } from "@/lib/content/editorial";
import { VictoryTrophy } from "./victory-trophy";

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `0:${String(sec).padStart(2, "0")}`;
}

type VictoryInfo = {
  id: string;
  moves: number;
  timeMs: number;
  difficulty: string;
  player: string;
};

async function fetchVictory(id: string): Promise<VictoryInfo | null> {
  const contractAddress = process.env.NEXT_PUBLIC_VICTORY_NFT_ADDRESS as `0x${string}` | undefined;
  if (!contractAddress) return null;

  try {
    const client = createPublicClient({ chain: celo, transport: http() });
    const tokenId = BigInt(id);

    const [victoryData, owner] = await Promise.all([
      client.readContract({ address: contractAddress, abi: victoryAbi, functionName: "victories", args: [tokenId] }),
      client.readContract({ address: contractAddress, abi: victoryAbi, functionName: "ownerOf", args: [tokenId] }),
    ]);

    const [diff, totalMoves, timeMs] = victoryData as [number, number, number];
    const ownerAddr = owner as string;

    return {
      id,
      moves: totalMoves,
      timeMs,
      difficulty: DIFFICULTY_LABELS[diff] ?? "Easy",
      player: `${ownerAddr.slice(0, 6)}...${ownerAddr.slice(-4)}`,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const v = await fetchVictory(params.id);

  const title = v ? VICTORY_PAGE_COPY.metaCheckmate(v.moves) : `Victory #${params.id}`;
  const description = v
    ? `${VICTORY_PAGE_COPY.metaChallenge(params.id)} ${v.difficulty} • ${formatTime(v.timeMs)}`
    : VICTORY_PAGE_COPY.metaFallback;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://chesscito.vercel.app");

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

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[var(--app-max-width)] flex-col items-center justify-center arena-bg px-6">
      <div className="flex w-full max-w-[340px] flex-col items-center rounded-3xl border border-white/[0.08] bg-[var(--surface-frosted)] px-6 pb-8 pt-10 backdrop-blur-2xl shadow-[0_0_60px_rgba(20,184,166,0.08)]">
        {/* Trophy */}
        <VictoryTrophy />

        {/* Title */}
        <h1 className="fantasy-title mb-2 text-2xl font-bold text-emerald-300/90 drop-shadow-[0_0_12px_rgba(20,184,166,0.35)]">
          {VICTORY_PAGE_COPY.metaCheckmate(v.moves)}
        </h1>

        {/* Stats */}
        <div className="mb-6 flex gap-3 text-sm text-cyan-100/50">
          <span>{v.difficulty}</span>
          <span>•</span>
          <span>{formatTime(v.timeMs)}</span>
          <span>•</span>
          <span>{v.player}</span>
        </div>

        {/* Challenge line */}
        <p className="mb-8 text-lg font-semibold text-amber-400">
          {VICTORY_PAGE_COPY.challengeLine}
        </p>

        {/* CTA */}
        <Link
          href="/arena"
          className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 py-3 text-center text-sm font-bold text-white shadow-[0_0_16px_rgba(20,184,166,0.25)] transition-all hover:shadow-[0_0_24px_rgba(20,184,166,0.4)] active:scale-[0.97]"
        >
          {VICTORY_PAGE_COPY.acceptChallenge}
        </Link>

        <Link
          href="/"
          className="mt-3 min-h-[44px] flex items-center text-sm text-white/50 transition-colors hover:text-white/70"
        >
          {VICTORY_PAGE_COPY.backToHub}
        </Link>
      </div>
    </main>
  );
}
