"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useHistoryReadAccess } from "@/lib/coach/use-history-read-access";
import type { GameRecord } from "@/lib/coach/types";
import { HistoryReadPrompt } from "./history-read-prompt";
import { CoachGameClient } from "@/app/[locale]/coach/[gameId]/coach-game-client";

export function PrivateGameReader({ gameId, wallet, locale }: {
  gameId: string; wallet: `0x${string}`; locale: "en" | "es";
}) {
  const access = useHistoryReadAccess(wallet);
  const { headers, invalidate } = access;
  const tRead = useTranslations("HISTORY_READ_COPY");
  const t = useTranslations("COACH_VIEWER_COPY");
  const [result, setResult] = useState<{ key: string; record: GameRecord | null; error: boolean } | null>(null);
  const key = `${wallet.toLowerCase()}:${gameId}:${locale}`;
  useEffect(() => {
    setResult(null);
    if (!headers) return;
    const controller = new AbortController();
    void fetch(`/api/games/${encodeURIComponent(gameId)}?wallet=${wallet}&locale=${locale}`, {
      headers, cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      if (response.status === 404) return null;
      if (response.status === 401) invalidate();
      if (!response.ok) throw new Error("Game unavailable");
      return await response.json() as GameRecord;
    }).then((record) => {
      if (!controller.signal.aborted) setResult({ key, record, error: false });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, record: null, error: true });
    });
    return () => controller.abort();
  }, [headers, invalidate, gameId, wallet, locale, key]);

  if (!headers) return <HistoryReadPrompt access={access} />;
  if (!result || result.key !== key) return <p role="status">{tRead("loading")}</p>;
  if (result.error) return <p role="alert">{t("loadErrorTitle")}</p>;
  return <CoachGameClient gameRecord={result.record} walletAddress={wallet} />;
}
