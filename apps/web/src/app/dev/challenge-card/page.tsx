"use client";

import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";

import { ChallengeCard, type ChallengeCardProps } from "@/components/hub/challenge-card";
import type { CtaSlotPresentation } from "@/lib/hub/cta-slot";
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

const CHALLENGE = { challengeGoalDays: 21,
  accessDurationDays: 30, shieldBonus: 3, priceLabel: "$0.99" };

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

/** The CTA slot each scenario should be handed, derived from its OWN passport.
 *
 *  ⚠️ Without this every card fell back to the un-hydrated status — the same
 *  trap the `/dev/learn-hub` probe had: a fixture photographs only what it is
 *  handed, so all nine states rendered the same terminal band and the page
 *  showed a picture the product cannot produce.
 *
 *  Coherence rule: the Content Loop returns `daily-pending` before anything
 *  else while the Daily is pending, so a pending day may never be paired with a
 *  terminal variant. A scenario can still override this explicitly. */
function slotFor(scenario: Scenario): CtaSlotPresentation {
  return scenario.props.focusPassport.todayDone
    ? {
        kind: "status",
        variant: "come-back-tomorrow",
        destination: null,
        labelKey: "ctaTomorrow",
        noteKey: "noteDailyReturns",
      }
    : {
        kind: "action",
        variant: "daily-pending",
        destination: "/exercises?piece=rook",
        labelKey: "ctaStartToday",
        noteKey: null,
      };
}

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
    note:
      "Goal met. The CHIP says COMPLETED and the slot keeps offering work — announcing it in the slot used to cost this player their next action permanently, since `completed` is terminal. No credit or reward is triggered by reaching it.",
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
      // Explicit override: the day is done, but the loop still has work for
      // someone who finished the challenge. That is the whole point of the fix,
      // so this scenario must not fall back to the terminal band.
      ctaSlot: {
        kind: "action",
        variant: "improve-stars",
        destination: "/exercises?piece=rook",
        labelKey: "ctaBeatScore",
        noteKey: null,
      },
    },
  },
  {
    id: "pro",
    label: "PRO — no countdown",
    note: "Access without a purchased window: the crowned badge says it, and nothing else does.",
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
              <ChallengeCard
                {...scenario.props}
                today={TODAY}
                ctaSlot={scenario.props.ctaSlot ?? slotFor(scenario)}
                onFocusTap={scenario.props.onFocusTap ?? (() => {})}
              />
            </section>
          ))}
        </div>
      </main>
    </NextIntlClientProvider>
  );
}

/** Kept honest: the union the card accepts, not a loose object. */
export type _ProgressFixture = ChallengeProgressView;
