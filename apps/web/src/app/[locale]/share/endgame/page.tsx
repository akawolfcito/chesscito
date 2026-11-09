import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { getShareOrigin } from "@/lib/og/share-urls";

type SearchParams = {
  mode?: string;
  name?: string;
  wk?: string;
  wr?: string;
  bk?: string;
  solved?: string;
  moves?: string;
  limit?: string;
};

type EndgameParams = {
  mode: "krk";
  name: string;
  wk: string;
  wr: string;
  bk: string;
  solved: boolean;
  moves: number;
  limit: number;
};

const SQUARE_RE = /^[a-h][1-8]$/;
const NAME_MAX = 40;
const MOVES_MAX = 999;

function normalizeSquare(raw: string | undefined): string {
  const lc = (raw ?? "").toLowerCase();
  return SQUARE_RE.test(lc) ? lc : "a1";
}

function parseClampedInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function normalize(searchParams: SearchParams, defaultName: string): EndgameParams {
  return {
    mode: "krk",
    name: (searchParams.name ?? defaultName).slice(0, NAME_MAX),
    wk: normalizeSquare(searchParams.wk),
    wr: normalizeSquare(searchParams.wr),
    bk: normalizeSquare(searchParams.bk),
    solved: searchParams.solved === "true",
    moves: parseClampedInt(searchParams.moves, 0, MOVES_MAX, 0),
    limit: parseClampedInt(searchParams.limit, 1, MOVES_MAX, 1),
  };
}

function buildOgImage(origin: string, p: EndgameParams): string {
  const params = new URLSearchParams({
    mode: p.mode,
    name: p.name,
    wk: p.wk,
    wr: p.wr,
    bk: p.bk,
  });
  if (p.solved) {
    params.set("solved", "true");
    params.set("moves", String(p.moves));
    params.set("limit", String(p.limit));
  }
  return `${origin}/api/og/endgame?${params.toString()}`;
}

function buildCanonical(origin: string, p: EndgameParams): string {
  const params = new URLSearchParams({
    mode: p.mode,
    name: p.name,
    wk: p.wk,
    wr: p.wr,
    bk: p.bk,
  });
  if (p.solved) {
    params.set("solved", "true");
    params.set("moves", String(p.moves));
    params.set("limit", String(p.limit));
  }
  return `${origin}/share/endgame?${params.toString()}`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const t = await getTranslations("ENDGAME_SHARE_COPY");
  const params = normalize(searchParams, t("defaultName"));
  const origin = getShareOrigin();
  const title = params.solved
    ? t("metaTitleSolved")
    : t("metaTitleChallenge");
  const description = params.solved
    ? t("ctaSolvedWithMoves", { moves: params.moves, limit: params.limit })
    : t("ctaChallenge");
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

export default async function ShareEndgamePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations("ENDGAME_SHARE_COPY");
  const tShare = await getTranslations("SHARE_COPY");
  const params = normalize(searchParams, t("defaultName"));
  const headline = params.solved ? t("headlineSolved") : t("headlineChallenge");
  const subhead = params.solved
    ? t("ctaSolvedWithMoves", { moves: params.moves, limit: params.limit })
    : t("ctaChallenge");

  return (
    <div className="mission-shell secondary-page-scrim flex min-h-[100dvh] items-center justify-center px-6">
      <div
        className="candy-page-panel flex w-full max-w-[var(--app-max-width)] flex-col items-center gap-4 rounded-3xl px-6 py-10 text-center"
        style={{ background: "var(--paper-bg)" }}
      >
        <p
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "rgba(110, 65, 15, 0.55)" }}
        >
          {t("kicker")} · {params.name}
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
          {tShare("playCta")}
        </Link>
      </div>
    </div>
  );
}
