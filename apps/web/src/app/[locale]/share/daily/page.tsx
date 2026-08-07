import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
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

function normalize(searchParams: SearchParams, defaultName: string): DailyParams {
  const rawPiece = (searchParams.piece ?? "").toLowerCase();
  const piece = (SHARE_PIECES as readonly string[]).includes(rawPiece)
    ? (rawPiece as SharePiece)
    : "rook";
  const name = (searchParams.name ?? defaultName).slice(0, NAME_MAX);
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
  const t = await getTranslations("DAILY_SHARE_COPY");
  const params = normalize(searchParams, t("defaultName"));
  const origin = getShareOrigin();
  const title = params.solved
    ? t("metaTitleSolved")
    : t("metaTitleChallenge");
  const description = params.solved
    ? params.streak > 0
      ? t("ctaSolvedWithStreak", { streak: params.streak })
      : t("ctaSolvedNoStreak")
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

export default async function ShareDailyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations("DAILY_SHARE_COPY");
  const tPiece = await getTranslations("PIECE_LABELS");
  const tShare = await getTranslations("SHARE_COPY");
  const params = normalize(searchParams, t("defaultName"));
  const pieceLabel = tPiece(params.piece);
  const headline = params.solved ? t("headlineSolved") : t("headlineChallenge");
  const subhead = params.solved
    ? params.streak > 0
      ? t("ctaSolvedWithStreak", { streak: params.streak })
      : t("ctaSolvedNoStreak")
    : t("ctaChallenge");

  return (
    <div className="mission-shell secondary-page-scrim flex min-h-[100dvh] items-center justify-center px-6">
      {/* Candy mission panel — cream wood frame + grass border via the
          screen-mission/panel-mision-icon.png asset (same vocabulary as
          MissionBriefing). Stretched 100% 100% so it fills the panel; the
          inner %-padding keeps content off the decorative border. */}
      <div
        className="relative w-full max-w-[var(--app-max-width)]"
        style={{
          backgroundImage: "url(/art/screen-mission/panel-mision-icon.png)",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          minHeight: "320px",
        }}
      >
        <div className="flex flex-col items-center gap-4 px-[12%] pt-[14%] pb-[13%] text-center">
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
          {/* Daily Tactic mark — same daily-icon-v1 sprite used across
              the hub/sheet. Static <picture> (no theme context on this
              public share page); avif/webp negotiated, png fallback. */}
          <picture>
            <source srcSet="/art/new-icons-chesscito/daily-icon-v1.avif" type="image/avif" />
            <source srcSet="/art/new-icons-chesscito/daily-icon-v1.webp" type="image/webp" />
            <img
              src="/art/new-icons-chesscito/daily-icon-v1.png"
              alt=""
              aria-hidden="true"
              draggable={false}
              className="h-14 w-14 object-contain drop-shadow-[0_2px_6px_rgba(120,65,5,0.35)]"
            />
          </picture>
          <p
            className="text-sm leading-snug"
            style={{ color: "rgba(110, 65, 15, 0.75)" }}
          >
            {subhead}
          </p>
          {/* Green CSS CTA — shared --cta-primary-green-* token family,
              the canonical primary-action vocabulary (matches
              .primary-play-cta--green-css). */}
          <Link
            href="/challenge/daily"
            className="mt-2 inline-flex min-h-[48px] items-center justify-center px-7 text-sm font-extrabold"
            style={{
              background: "var(--cta-primary-green-grad)",
              border: "2px solid var(--cta-primary-green-border)",
              borderRadius: "1.1rem",
              boxShadow: "var(--cta-primary-green-bevel)",
              color: "#fffdf5",
              textShadow: "var(--cta-primary-green-text-shadow)",
            }}
          >
            Play today&apos;s challenge
          </Link>
        </div>
      </div>
    </div>
  );
}
