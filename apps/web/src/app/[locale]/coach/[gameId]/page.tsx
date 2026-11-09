import { isAddress } from "viem";
import { getTranslations } from "next-intl/server";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TileIconSlot } from "@/components/ui/tile-icon-slot";
import { UUID_RE } from "@/lib/coach/game-persistence";
import { PrivateGameReader } from "@/components/coach/private-game-reader";
import { CoachGameClient } from "./coach-game-client";

type PageProps = {
  params: Promise<{ locale: string; gameId: string }>;
  searchParams: Promise<{ wallet?: string }>;
};

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

  // Query parameters identify a requested resource, never its owner.
  // Do not serialize private records into HTML/RSC before wallet verification.
  return (
    <div className="arena-bg arena-scroll-screen h-[100dvh]">
      <PrivateGameReader gameId={gameId} wallet={wallet as `0x${string}`} locale={analysisLocale} />
    </div>
  );
}
