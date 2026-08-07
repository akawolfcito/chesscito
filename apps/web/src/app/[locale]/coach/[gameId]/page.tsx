import { getRedis } from "@/lib/server/redis";
import { isAddress } from "viem";
import { getTranslations } from "next-intl/server";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { UUID_RE, getGameRecord } from "@/lib/coach/game-persistence";
import { createLogger } from "@/lib/server/logger";
import { CoachGameClient } from "./coach-game-client";

type PageProps = {
  params: Promise<{ locale: string; gameId: string }>;
  searchParams: Promise<{ wallet?: string }>;
};

const redis = getRedis();
const log = createLogger({ route: "/coach/[gameId]" });

export default async function CoachGamePage({ params, searchParams }: PageProps) {
  const { gameId, locale } = await params;
  const { wallet } = await searchParams;
  const t = await getTranslations("COACH_VIEWER_COPY");
  const analysisLocale: "en" | "es" = locale === "es" ? "es" : "en";

  // No wallet -> render reconnect prompt path. Client wrapper handles the toast.
  if (!wallet) {
    return (
      <div className="arena-bg arena-scroll-screen h-[100dvh]">
        <ContextualHeader
          variant="back-control"
          iconSlot={<TileIconSlot slot="hub.training" />}
          title={t("reconnectTitle")}
          subtitle={t("reconnectSubtitle")}
        />
        <CoachGameClient gameRecord={null} walletAddress={undefined} />
      </div>
    );
  }

  // Input guards mirror the /api/games/[id] route so an invalid wallet/UUID
  // surfaces the same in-page 404 fallback instead of leaking a 500.
  if (!isAddress(wallet) || !UUID_RE.test(gameId)) {
    return (
      <div className="arena-bg arena-scroll-screen h-[100dvh]">
        <ContextualHeader
          variant="back-control"
          iconSlot={<TileIconSlot slot="hub.training" />}
          title={t("notFoundMessage")}
        />
        <CoachGameClient gameRecord={null} walletAddress={wallet as `0x${string}`} />
      </div>
    );
  }

  // Read Redis directly — the prior SSR→`/api/games/[id]` fetch was a same-
  // deployment HTTP roundtrip that didn't carry the user's auth cookie, so
  // Vercel Deployment Protection rejected it with 401. The wallet-scoped
  // Redis key is the canonical privacy boundary; the API route remains for
  // legitimate client-side reads.
  let gameRecord;
  try {
    gameRecord = await getGameRecord(redis, wallet, gameId, {
      locale: analysisLocale,
    });
  } catch (err) {
    log.error("game_fetch_error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return (
      <div className="arena-bg arena-scroll-screen h-[100dvh]">
        <ContextualHeader
          variant="back-control"
          iconSlot={<TileIconSlot slot="hub.training" />}
          title={t("loadErrorTitle")}
          subtitle={t("loadErrorSubtitle")}
        />
        <CoachGameClient gameRecord={null} walletAddress={wallet as `0x${string}`} />
      </div>
    );
  }

  if (!gameRecord) {
    return (
      <div className="arena-bg arena-scroll-screen h-[100dvh]">
        <ContextualHeader
          variant="back-control"
          iconSlot={<TileIconSlot slot="hub.training" />}
          title={t("notFoundMessage")}
        />
        <CoachGameClient gameRecord={null} walletAddress={wallet as `0x${string}`} />
      </div>
    );
  }

  // Success branch — Cluster C owns the visor chrome end-to-end. The
  // shell's ContextualHeader was rendering "Match review" a second
  // time above the new header band the client emits (2026-05-29).
  // Error/no-record branches still render ContextualHeader for shell
  // consistency, since they don't reach the redesigned actions stack.
  return (
    <div className="arena-bg arena-scroll-screen h-[100dvh]">
      <CoachGameClient gameRecord={gameRecord} walletAddress={wallet as `0x${string}`} />
    </div>
  );
}
