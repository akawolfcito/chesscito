import type { Metadata } from "next";
import Link from "next/link";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { victoryAbi } from "@/lib/contracts/victory";

const DIFFICULTY_LABEL: Record<number, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };

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
      difficulty: DIFFICULTY_LABEL[diff] ?? "Easy",
      player: `${ownerAddr.slice(0, 6)}...${ownerAddr.slice(-4)}`,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const v = await fetchVictory(params.id);

  const title = v ? `Checkmate in ${v.moves} moves` : `Victory #${params.id}`;
  const description = v
    ? `Can you beat that? Victory #${params.id} claimed onchain. ${v.difficulty} • ${formatTime(v.timeMs)}`
    : "Can you beat this? Play Chesscito on Celo.";

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

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center arena-bg px-6">
      <div className="flex w-full max-w-[340px] flex-col items-center rounded-3xl border border-white/[0.08] bg-[#0a1424]/92 px-6 pb-8 pt-10 backdrop-blur-2xl shadow-[0_0_60px_rgba(20,184,166,0.08)]">
        {/* Trophy */}
        <div className="mb-4 text-6xl">🏆</div>

        {/* Title */}
        <h1 className="fantasy-title mb-2 text-2xl font-bold text-emerald-300/90 drop-shadow-[0_0_12px_rgba(20,184,166,0.35)]">
          {v ? `Checkmate in ${v.moves} moves` : `Victory #${params.id}`}
        </h1>

        {/* Stats */}
        {v && (
          <div className="mb-6 flex gap-3 text-sm text-cyan-100/50">
            <span>{v.difficulty}</span>
            <span>•</span>
            <span>{formatTime(v.timeMs)}</span>
            <span>•</span>
            <span>{v.player}</span>
          </div>
        )}

        {/* Challenge line */}
        <p className="mb-8 text-lg font-semibold text-amber-400">
          Can you beat this?
        </p>

        {/* CTA */}
        <Link
          href="/arena"
          className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 py-3 text-center text-sm font-bold text-white shadow-[0_0_16px_rgba(20,184,166,0.25)] transition-all hover:shadow-[0_0_24px_rgba(20,184,166,0.4)] active:scale-[0.97]"
        >
          Accept Challenge
        </Link>

        <Link
          href="/"
          className="mt-3 text-xs text-white/30 transition-colors hover:text-white/50"
        >
          Back to Hub
        </Link>
      </div>
    </main>
  );
}
