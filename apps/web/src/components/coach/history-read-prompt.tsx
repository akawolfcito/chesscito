"use client";

import { useTranslations } from "next-intl";
import type { useHistoryReadAccess } from "@/lib/coach/use-history-read-access";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";

export function HistoryReadPrompt({ access }: { access: ReturnType<typeof useHistoryReadAccess> }) {
  const t = useTranslations("HISTORY_READ_COPY");
  return (
    <section className="tj-empty-state" aria-label={t("title")}>
      <h2 className="tj-empty-state-title">{t("title")}</h2>
      <p className="tj-empty-state-body">{t(access.canAuthorize ? "body" : "walletMismatch")}</p>
      {access.error && <p role="alert">{t("error")}</p>}
      <PrincipalButton disabled={!access.canAuthorize || access.pending} onClick={() => void access.authorize()}>
        {t(access.pending ? "pending" : "action")}
      </PrincipalButton>
    </section>
  );
}
