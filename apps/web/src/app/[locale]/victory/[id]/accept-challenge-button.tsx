"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";

/**
 * Client wrapper for the /victory/[id] accept-challenge CTA.
 *
 * The page itself is a Server Component (it fetches victory data via
 * a public RPC client at request time), but PrincipalButton is a
 * client primitive and the action requires `useRouter`. This thin
 * wrapper isolates the client boundary so the page stays server-rendered.
 */
export function AcceptChallengeButton() {
  const router = useRouter();
  const t = useTranslations("VICTORY_PAGE_COPY");
  const label = t("acceptChallenge");
  return (
    <PrincipalButton
      size="large"
      onClick={() => router.push("/arena?fresh=1")}
      aria-label={label}
    >
      {label}
    </PrincipalButton>
  );
}
