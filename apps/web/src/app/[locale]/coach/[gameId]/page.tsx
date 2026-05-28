import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import type { GameRecord } from "@/lib/coach/types";
import { CoachGameClient } from "./coach-game-client";

type PageProps = {
  params: Promise<{ locale: string; gameId: string }>;
  searchParams: Promise<{ wallet?: string }>;
};

export default async function CoachGamePage({ params, searchParams }: PageProps) {
  const { gameId } = await params;
  const { wallet } = await searchParams;
  const t = await getTranslations("COACH_VIEWER_COPY");

  // No wallet -> render reconnect prompt path. Client wrapper handles the toast.
  if (!wallet) {
    return (
      <main className="arena-bg arena-scroll-screen h-[100dvh]">
        <ContextualHeader
          variant="back-control"
          iconSlot={<TileIconSlot src="/art/new-icons-chesscito/training" />}
          title={t("reconnectTitle")}
          subtitle={t("reconnectSubtitle")}
        />
        <CoachGameClient gameRecord={null} walletAddress={undefined} />
      </main>
    );
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const url = `${proto}://${host}/api/games/${encodeURIComponent(gameId)}?wallet=${encodeURIComponent(wallet)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const is404 = res.status === 404;
    return (
      <main className="arena-bg arena-scroll-screen h-[100dvh]">
        <ContextualHeader
          variant="back-control"
          iconSlot={<TileIconSlot src="/art/new-icons-chesscito/training" />}
          title={is404 ? t("notFoundMessage") : t("loadErrorTitle")}
          subtitle={is404 ? undefined : t("loadErrorSubtitle")}
        />
        <CoachGameClient gameRecord={null} walletAddress={wallet as `0x${string}`} />
      </main>
    );
  }

  const gameRecord = (await res.json()) as GameRecord;

  return (
    <main className="arena-bg arena-scroll-screen h-[100dvh]">
      <ContextualHeader
        variant="back-control"
        iconSlot={<TileIconSlot src="/art/new-icons-chesscito/training" />}
        title={t("title")}
      />
      <CoachGameClient gameRecord={gameRecord} walletAddress={wallet as `0x${string}`} />
    </main>
  );
}
