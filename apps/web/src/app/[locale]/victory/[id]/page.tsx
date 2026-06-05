import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { victoryAbi } from "@/lib/contracts/victory";
import { DIFFICULTY_LABELS } from "@/lib/content/editorial";
import { formatTime } from "@/lib/game/arena-utils";
import { CandyIcon } from "@/components/redesign/candy-icon";
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

  const isCheckmate = ARENA_DIFFICULTIES.has(v.difficultyRaw);
  const headline = isCheckmate
    ? t("metaCheckmate", { moves: v.moves })
    : t("metaComplete", { moves: v.moves });

  return (
    <main
      className="arena-bg flex min-h-[100dvh] items-center justify-center px-4 py-6 animate-in fade-in duration-500"
    >
      {/* Panel-mision card — same panel-bg1 background as arena-end-state
          popups (forest-leaf corners + cream interior). No close button:
          this is a destination route, not a modal. */}
      <div
        className="relative w-full max-w-[340px] max-h-[92dvh] overflow-y-auto overscroll-contain"
        style={{
          backgroundImage:
            'image-set(url("/art/new-assets-chesscito/paneles/panel-bg1.avif") type("image/avif"), url("/art/new-assets-chesscito/paneles/panel-bg1.webp") type("image/webp"), url("/art/new-assets-chesscito/paneles/panel-bg1.png") type("image/png"))',
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div
          className="arena-result-popup-content"
          style={{ paddingTop: "12%" }}
        >
          {/* Headline — Checkmate / Complete in N moves. Uses the same
              arena-result-title family but at the hero-text-inside size
              because the full label is long (matches the loss-popup
              "Checkmate" + subtitle pattern). */}
          <h1
            className="arena-result-title text-center"
            style={{ fontSize: "clamp(24px, 5dvh, 32px)" }}
          >
            {headline}
          </h1>

          {/* Stat pills — Difficulty / Moves / Time. Same .candy-stat-pill
              vocabulary as arena-end-state stats row. */}
          <div className="arena-result-stats-row arena-result-stats-row--missionpills mt-2">
            <span className="candy-stat-pill">
              <span className="candy-stat-pill-icon">
                <CandyIcon name="star" className="h-4 w-4" />
              </span>
              {v.difficulty}
            </span>
            <span className="candy-stat-pill">
              <span className="candy-stat-pill-icon">
                <picture>
                  <source srcSet="/art/redesign/pieces/w-pawn.avif" type="image/avif" />
                  <source srcSet="/art/redesign/pieces/w-pawn.webp" type="image/webp" />
                  <img
                    src="/art/redesign/pieces/w-pawn.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="block h-full w-full object-contain"
                  />
                </picture>
              </span>
              {String(v.moves)}
            </span>
            <span className="candy-stat-pill">
              <span className="candy-stat-pill-icon">
                <CandyIcon name="time" className="h-4 w-4" />
              </span>
              {formatTime(v.timeMs)}
            </span>
          </div>

          {/* Challenge block — coach-section pattern. challengeLine reads
              as the focal headline ("Can you beat this?"), tagline as the
              supporting body. Avatar-confiado floats RIGHT, addressing
              the visitor: "Sí, alguien lo logró — ¿tú puedes?". */}
          <div className="arena-result-coach-section mt-4">
            <div className="arena-result-coach-body">
              <div className="arena-result-coach-text">
                <h2 className="arena-result-coach-headline">
                  {t("challengeLine")}
                </h2>
                <p className="arena-result-coach-body-text">{t("tagline")}</p>
              </div>
              <picture className="arena-result-coach-avatar">
                <source srcSet="/art/new-assets-chesscito/fun/avatar-confiado.avif" type="image/avif" />
                <source srcSet="/art/new-assets-chesscito/fun/avatar-confiado.webp" type="image/webp" />
                <img
                  src="/art/new-assets-chesscito/fun/avatar-confiado.png"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                />
              </picture>
            </div>
          </div>

          {/* Primary action — Accept Challenge → /arena?fresh=1. */}
          <div className="mt-4 flex w-full justify-center">
            <AcceptChallengeButton />
          </div>

          {/* Back affordance — same .arena-result-back-link chip migrated
              in Cluster 2 (2026-06-05, commit b04c4318). */}
          <Link
            href="/hub"
            className="arena-result-back-link mt-3 inline-flex min-h-[44px] items-center justify-center"
          >
            {t("backToHub")}
          </Link>
        </div>
      </div>
    </main>
  );
}
