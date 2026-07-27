"use client";

import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";

import { ChallengeCard, type ChallengeCardProps } from "@/components/hub/challenge-card";
import enMessages from "@/lib/content/messages/en";
import esMessages from "@/lib/content/messages/es";
import type { ChallengeProgressView } from "@/lib/season-pass/focus-days";

/**
 * Visual fixture for the ChallengeCard's Focus Days states (Stage 2).
 *
 * These states cannot be reached by clicking: they need a live pass, a ledger
 * answer, and in two cases a failure. The card is a pure leaf, so every state is
 * one prop object — which makes the whole matrix photographable side by side,
 * at the real 390px, in both locales.
 *
 * The row most likely to break is progress + countdown + streak, and it breaks
 * in Spanish first (longer words). That is why the locale toggle is here and not
 * left to the browser.
 *
 * Fixtures ONLY — nothing here reads localStorage, wagmi or the network.
 */

export const dynamic = "force-dynamic";

const TODAY = "2026-04-25";

const CHALLENGE = { durationDays: 21, shieldBonus: 3, priceLabel: "$0.99" };

function passport(streak: number, todayDone = false, lastCompletedDate = "2026-04-24") {
  return {
    streak,
    totalCompleted: streak,
    todayDone,
    isLoading: false,
    lastCompletedDate,
  };
}

type Scenario = {
  id: string;
  label: string;
  note: string;
  props: Omit<ChallengeCardProps, "today">;
};

const SCENARIOS: Scenario[] = [
  {
    id: "offer",
    label: "offer — no pass",
    note: "Unchanged by Stage 2. No progress number: there is nothing recorded to show.",
    props: {
      focusPassport: passport(1, false, TODAY),
      challenge: CHALLENGE,
      seasonPass: { active: false, isLoading: false },
      progress: { state: "offer" },
      onJoinChallenge: () => {},
    },
  },
  {
    id: "active",
    label: "active — the three metrics",
    note: "Progress + window + streak. Three different numbers in one row: the one to watch at 390px.",
    props: {
      focusPassport: passport(3, false),
      challenge: CHALLENGE,
      seasonPass: { active: true, source: "season_pass", shieldsCredited: 3 },
      progress: {
        state: "active",
        progress: { completed: 3, goal: 21 },
        window: { kind: "expiring", daysRemaining: 18 },
        streak: 3,
        unreachable: false,
      },
      onJoinChallenge: null,
    },
  },
  {
    id: "active-two-digit",
    label: "active — two-digit streak",
    note: "The widest ordinary case: 12 of 21, two-digit countdown, two-digit streak.",
    props: {
      focusPassport: passport(12, true, TODAY),
      challenge: CHALLENGE,
      seasonPass: { active: true, source: "season_pass", shieldsCredited: 3 },
      progress: {
        state: "active",
        progress: { completed: 12, goal: 21 },
        window: { kind: "expiring", daysRemaining: 10 },
        streak: 12,
        unreachable: false,
      },
      onJoinChallenge: null,
    },
  },
  {
    id: "unreachable",
    label: "active — unreachable",
    note: "More days owed than days left. Extra copy block; the CTA STAYS (a warning must not become a dead end).",
    props: {
      focusPassport: passport(1, false),
      challenge: CHALLENGE,
      seasonPass: { active: true, source: "season_pass", shieldsCredited: 3 },
      progress: {
        state: "active",
        progress: { completed: 4, goal: 21 },
        window: { kind: "expiring", daysRemaining: 2 },
        streak: 1,
        unreachable: true,
      },
      onJoinChallenge: null,
    },
  },
  {
    id: "expired-window",
    label: "active — 0 days left",
    note: "The pass ran out today. The countdown must say zero, not disappear.",
    props: {
      focusPassport: passport(9, false),
      challenge: CHALLENGE,
      seasonPass: { active: true, source: "season_pass", shieldsCredited: 3 },
      progress: {
        state: "active",
        progress: { completed: 9, goal: 21 },
        window: { kind: "expiring", daysRemaining: 0 },
        streak: 9,
        unreachable: true,
      },
      onJoinChallenge: null,
    },
  },
  {
    id: "completed",
    label: "completed — 21 of 21",
    note: "Goal met. The CTA changes; no credit or reward is triggered by reaching it.",
    props: {
      focusPassport: passport(21, true, TODAY),
      challenge: CHALLENGE,
      seasonPass: { active: true, source: "season_pass", shieldsCredited: 3 },
      progress: {
        state: "completed",
        progress: { completed: 21, goal: 21 },
        window: { kind: "expiring", daysRemaining: 3 },
        streak: 21,
      },
      onJoinChallenge: null,
    },
  },
  {
    id: "pro",
    label: "PRO — no countdown",
    note: "Access without a purchased window: 'Included with PRO' and NO days-left chip.",
    props: {
      focusPassport: passport(6, false),
      challenge: CHALLENGE,
      seasonPass: { active: true, source: "pro" },
      progress: {
        state: "active",
        progress: { completed: 6, goal: 21 },
        window: { kind: "unbounded" },
        streak: 6,
        unreachable: false,
      },
      onJoinChallenge: null,
    },
  },
  {
    id: "degraded",
    label: "degraded — ledger down",
    note: "A failure of OURS, said plainly. No number, and the streak must NOT stand in for it.",
    props: {
      focusPassport: passport(5, false),
      challenge: CHALLENGE,
      seasonPass: { active: true, source: "season_pass", shieldsCredited: 3 },
      progress: {
        state: "degraded",
        window: { kind: "expiring", daysRemaining: 16 },
        streak: 5,
      },
      onJoinChallenge: null,
    },
  },
  {
    id: "disabled",
    label: "disabled — kill switch off",
    note: "A decision of ours: the card says nothing about progress. Must NOT look like the failure above.",
    props: {
      focusPassport: passport(5, false),
      challenge: CHALLENGE,
      seasonPass: { active: true, source: "season_pass", shieldsCredited: 3 },
      progress: {
        state: "disabled",
        window: { kind: "expiring", daysRemaining: 16 },
        streak: 5,
      },
      onJoinChallenge: null,
    },
  },
];

export default function ChallengeCardDevPage() {
  const [locale, setLocale] = useState<"en" | "es">("en");

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "es" ? esMessages : enMessages}
    >
      <main
        data-testid="dev-challenge-card-root"
        className="min-h-[100dvh] w-full bg-[#1a0f0a] p-4"
      >
        <div className="mx-auto flex w-full max-w-[var(--app-max-width)] flex-col gap-6">
          <div className="flex items-center gap-2">
            {(["en", "es"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                data-testid={`dev-locale-${code}`}
                aria-pressed={locale === code}
                className={`rounded-full px-4 py-2 text-sm font-bold uppercase ${
                  locale === code ? "bg-[#f5d67b] text-[#3a2408]" : "bg-[#3a2408] text-[#f5d67b]"
                }`}
              >
                {code}
              </button>
            ))}
            <span className="text-xs text-[#c9a97a]">
              width is the real 390px cap
            </span>
          </div>

          {SCENARIOS.map((scenario) => (
            <section key={scenario.id} data-scenario={scenario.id} className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-[#f5d67b]">
                {scenario.label}
              </p>
              <p className="text-xs leading-snug text-[#c9a97a]">{scenario.note}</p>
              <ChallengeCard {...scenario.props} today={TODAY} />
            </section>
          ))}
        </div>
      </main>
    </NextIntlClientProvider>
  );
}

/** Kept honest: the union the card accepts, not a loose object. */
export type _ProgressFixture = ChallengeProgressView;
