import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { victoryAbi } from "@/lib/contracts/victory";
import { DIFFICULTY_LABELS, VICTORY_PAGE_COPY } from "@/lib/content/editorial";
import { formatTime } from "@/lib/game/arena-utils";
import { VictoryTrophy } from "./victory-trophy";

/** Arena difficulty values (1–3) represent checkmate victories */
const ARENA_DIFFICULTIES = new Set([1, 2, 3]);

type VictoryInfo = {
  id: string;
  moves: number;
  timeMs: number;
  difficulty: string;
  difficultyRaw: number;
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
      difficultyRaw: diff,
      player: `${ownerAddr.slice(0, 6)}...${ownerAddr.slice(-4)}`,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const v = await fetchVictory(params.id);

  const isCheckmate = v ? ARENA_DIFFICULTIES.has(v.difficultyRaw) : false;
  const title = v
    ? (isCheckmate ? VICTORY_PAGE_COPY.metaCheckmate(v.moves) : VICTORY_PAGE_COPY.metaComplete(v.moves))
    : `Victory #${params.id}`;
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
    <main className="mx-auto flex min-h-[100dvh] max-w-[var(--app-max-width)] flex-col items-center justify-center arena-bg px-6 animate-in fade-in duration-500">
      <div className="relative flex w-full max-w-[340px] flex-col items-center overflow-hidden rounded-3xl border-2 border-amber-400/40 bg-[var(--surface-frosted)] px-6 pb-8 pt-10 backdrop-blur-2xl shadow-[0_0_40px_rgba(251,191,36,0.22),inset_0_0_0_1px_rgba(251,191,36,0.10)] animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Trophy spotlight — subtle amber glow behind the trophy */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-48"
          style={{
            background:
              "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(251,191,36,0.18) 0%, rgba(251,191,36,0) 70%)",
          }}
        />

        {/* Trophy */}
        <div className="relative z-10">
          <VictoryTrophy />
        </div>

        {/* Title */}
        <h1 className="fantasy-title relative z-10 mb-2 text-3xl font-bold text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.45)]">
          {ARENA_DIFFICULTIES.has(v.difficultyRaw)
            ? VICTORY_PAGE_COPY.metaCheckmate(v.moves)
            : VICTORY_PAGE_COPY.metaComplete(v.moves)}
        </h1>

        {/* Stats */}
        <div className="relative z-10 mb-3 flex gap-3 text-sm text-amber-100/60">
          <span>{v.difficulty}</span>
          <span>•</span>
          <span>{formatTime(v.timeMs)}</span>
          <span>•</span>
          <span>{v.player}</span>
        </div>

        {/* Tagline for new visitors */}
        <p className="relative z-10 mb-4 text-center text-xs text-amber-100/45">
          {VICTORY_PAGE_COPY.tagline}
        </p>

        {/* Challenge line */}
        <p className="relative z-10 mb-8 text-lg font-semibold text-amber-300">
          {VICTORY_PAGE_COPY.challengeLine}
        </p>

        {/* CTA */}
        <Link
          href="/arena"
          className="relative z-10 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 py-3 text-center text-sm font-bold text-[rgba(63,34,8,0.95)] shadow-[0_0_18px_rgba(251,191,36,0.35)] transition-all hover:shadow-[0_0_26px_rgba(251,191,36,0.55)] active:scale-[0.97]"
        >
          {VICTORY_PAGE_COPY.acceptChallenge}
        </Link>

        <Link
          href="/"
          className="relative z-10 mt-3 min-h-[44px] flex items-center px-3 text-sm text-amber-100/45 transition-colors hover:text-amber-100/70"
        >
          {VICTORY_PAGE_COPY.backToHub}
        </Link>
      </div>
    </main>
  );
}
