"use client";

import { useCallback, useRef, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { useLocale } from "next-intl";
import type { CoachResponse, BasicCoachResponse } from "./types";
import { generateQuickReview } from "./fallback-engine";
import { shouldShowPaywall } from "./paywall-gate";
import { requestCoachAnalyze } from "./request-coach-analyze";
import {
  trackAnalyzeRequest,
  trackAnalyzeIdempotentHit,
  trackAnalyzeFailed,
  type AnalyzeSource,
} from "./analyze-telemetry";
import { useIsProActive } from "@/lib/pro/use-is-pro-active";
import { attemptCoachSpendWithPeones } from "@/lib/peones/coach-spend-fallback";
import type { CoachLocale } from "./prompt-template";

export type CoachPhase =
  | "idle"
  | "loading"
  | "review"
  | "result"
  | "fallback"
  | "paywall"
  | "welcome"
  | "history";

export type CoachAnalysisInjected = {
  address?: `0x${string}`;
  chainId?: number;
  proActive?: boolean;
  activeLocale?: "en" | "es";
};

export type CoachAnalysisInput = {
  gameId?: string;                           // required when calling askCoach; can be undefined on initial render
  walletAddress?: `0x${string}`;
  result?: "win" | "lose" | "draw" | "resigned";
  difficulty?: "easy" | "medium" | "hard";
  moves?: string[];
  elapsedMs?: number;
  surface: "arena_endgame" | "coach_viewer";
  /** Consumer-provided overrides. */
  injected?: CoachAnalysisInjected;
  /** Called when the hook would fire arena_coach_analyze telemetry —
   *  consumer fires the actual track() with the right surface dim. */
  onAnalyzeTelemetry?: (event: {
    stage: "request" | "idempotent_hit" | "failed";
    gameId: string;
    source?: string;
  }) => void;
  /**
   * Arena-only inputs that drive startCoachAnalysis internally.
   * Not needed for the coach_viewer surface.
   */
  isConnected?: boolean;
};

export type CoachAnalysisState = {
  phase: CoachPhase;
  response: CoachResponse | BasicCoachResponse | null;
  fallbackResponse: BasicCoachResponse | null;
  jobId: string | null;
  credits: number;
  analysisLocale?: "en" | "es";
  reanalyzeGameId: string | null;
  isReanalyzing: boolean;
  serverError: string | null;
  /** PRO-only session-history footer payload from the analyze response.
   *  Mirrors `data.historyMeta` from /api/coach/analyze. Used by
   *  <CoachPanel> to render the "Reviewing N sessions" footer + the
   *  personalized-coaching subtitle. Undefined for free users / pre-ready
   *  phases (#117). */
  historyMeta?: { gamesPlayed: number };
  setPhase: (p: CoachPhase) => void;
  askCoach: (source?: "immediate" | "victory-mint" | "history" | "viewer") => void;
  analyzeFromHistory: (gameId: string) => void;
  reanalyze: () => Promise<void>;
  claimWelcome: () => Promise<void>;
  abort: () => void;
};

/**
 * Coach phase machine — transplanted from arena/page.tsx in T5b.
 *
 * Owns all coach-related state (coachPhase, coachResponse,
 * coachFallbackResponse, coachJobId, coachCredits, coachAnalysisLocale,
 * coachReanalyzeGameId, coachServerError, isReanalyzing, analyzeSourceRef,
 * coachAbortRef). Telemetry is NOT fired from inside the hook — the consumer
 * receives callbacks (onAnalyzeTelemetry) so it can add the right surface dim.
 *
 * Behind feature flag NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS — default OFF.
 * Legacy inline path in arena/page.tsx is the source of truth until T13.
 *
 * @remarks
 * Single-game-mount expectation: this hook's state initializes on mount
 * and does not auto-reset when input identity changes. Pass `key={gameId}`
 * to force remount between games.
 */
export function useCoachAnalysis(input: CoachAnalysisInput): CoachAnalysisState {
  // --- wagmi / intl reads with injected overrides ---
  const wagmiAccount = useAccount();
  const wagmiChainId = useChainId();
  const activeLocaleHook = useLocale() as "en" | "es";
  const proActiveHook = useIsProActive();

  const address = input.injected?.address ?? input.walletAddress ?? wagmiAccount.address;
  // chainId is available for future use (e.g., multi-chain credits endpoint)
  const _chainId = input.injected?.chainId ?? wagmiChainId; // eslint-disable-line no-unused-vars
  const activeLocale = (input.injected?.activeLocale ?? activeLocaleHook) as CoachLocale;
  const proActive = input.injected?.proActive ?? proActiveHook;

  const isConnected = input.isConnected ?? wagmiAccount.isConnected;
  // Destructured to make `onAnalyzeTelemetry` a direct callback dep (avoids
  // react-hooks/exhaustive-deps warnings on optional-chain accessors).
  const { onAnalyzeTelemetry } = input;

  // --- phase machine state ---
  const [phase, setPhaseState] = useState<CoachPhase>("idle");
  const [coachJobId, setCoachJobId] = useState<string | null>(null);
  const [coachResponse, setCoachResponse] = useState<CoachResponse | null>(null);
  const [coachFallbackResponse, setCoachFallbackResponse] = useState<BasicCoachResponse | null>(null);
  const [coachCredits, setCoachCredits] = useState(0);
  const [coachAnalysisLocale, setCoachAnalysisLocale] = useState<"en" | "es" | undefined>(undefined);
  const [coachReanalyzeGameId, setCoachReanalyzeGameId] = useState<string | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [coachServerError, setCoachServerError] = useState<string | null>(null);
  const [coachHistoryMeta, setCoachHistoryMeta] = useState<{ gamesPlayed: number } | undefined>(undefined);

  // Internal refs
  const analyzeSourceRef = useRef<AnalyzeSource>("immediate");
  const coachAbortRef = useRef<AbortController | null>(null);

  // Stable setPhase
  const setPhase = useCallback((p: CoachPhase) => setPhaseState(p), []);

  // --- startCoachAnalysis (core machine) ---
  // Mirrors arena/page.tsx startCoachAnalysis. Reads game context from
  // input fields (result, difficulty, moves, elapsedMs, gameId).
  const startCoachAnalysis = useCallback(async () => {
    if (!address) return;
    const movesArr = input.moves ?? [];
    if (movesArr.length === 0) return;

    const gameResult = input.result ?? "lose";
    const difficulty = input.difficulty ?? "easy";
    const elapsedMs = input.elapsedMs ?? 0;
    const analyzeGameId = input.gameId ?? null;

    // Abort any previous in-flight analysis, show loading immediately
    coachAbortRef.current?.abort();
    setCoachJobId(null);
    setPhaseState("loading");

    const controller = new AbortController();
    coachAbortRef.current = controller;
    const { signal } = controller;

    try {
      // PRO status: trust the injected/hook value first; fall back to a fresh
      // fetch if still false (covers landing directly on /arena before the hook
      // settles — mirrors the arena/page.tsx pattern).
      let resolvedProActive = proActive;
      if (!resolvedProActive) {
        try {
          const proRes = await fetch(`/api/pro/status?wallet=${address}`, { signal });
          if (proRes.ok) {
            const proData = await proRes.json() as { active?: boolean };
            resolvedProActive = proData?.active === true;
          }
        } catch { /* keep resolvedProActive false */ }
      }

      // Plan 2 (P2 guard) — a tap with no persisted gameId can never reach a
      // renderable viewer, so it must NEVER debit a Peón/credit. Bail to the
      // inline quick-review fallback BEFORE the spend block below. (This check
      // is repeated after the spend for the offline/error paths.)
      if (!analyzeGameId) {
        setCoachServerError("not_persisted");
        const quick = generateQuickReview({
          result: gameResult,
          difficulty,
          totalMoves: movesArr.length,
          elapsedMs,
        });
        setCoachFallbackResponse(quick);
        setPhaseState("fallback");
        return;
      }

      const creditsRes = await fetch(`/api/coach/credits?wallet=${address}`, { signal });
      const creditsData = await creditsRes.json() as { credits?: number };
      const credits = creditsData.credits ?? 0;
      setCoachCredits(credits);

      // Sprint 4 commit F — Peones fallback. Order of consumption
      // (calibration §7, founder sign-off 2026-06-08):
      //   1. Redis Coach credits  (existing — credits>0 short-circuits)
      //   2. PRO bypass           (TODO commit G — slot intentionally
      //                            deferred; `applyProBypass` stays
      //                            false everywhere in this commit)
      //   3. Peones spend         (NEW — when credits=0 and !PRO)
      //   4. Upsell / paywall     (existing — fall-through)
      //
      // PRO short-circuits credits today, so the actual order this
      // commit ships is Redis → Peones → Paywall when PRO is absent.
      let peonesIdempotencyKey: string | null = null;
      if (shouldShowPaywall({ proActive: resolvedProActive, credits })) {
        const attempt = await attemptCoachSpendWithPeones({
          wallet: address.toLowerCase(),
          gameId: analyzeGameId ?? "",
        });
        if (attempt.kind === "paid") {
          peonesIdempotencyKey = attempt.peonesIdempotencyKey;
          // Reflect the unlock in the local credits state so any UI
          // gated on `credits > 0` (e.g. paywall guards) transitions
          // immediately. The server is the source of truth — we do
          // NOT decrement again after the analyze response.
          setCoachCredits(1);
        } else {
          // insufficient | error — fall back to the paywall surface;
          // telemetry already fired inside attemptCoachSpendWithPeones.
          setPhaseState("paywall");
          return;
        }
      }

      // Offline guard. #118: serverError is a semantic flag, not copy
      // (sister values are "not_persisted" / "error"). Consumers read it
      // as a truthy toggle and resolve their own localized title via
      // useTranslations — the hook stays locale-agnostic.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setCoachServerError("offline");
        const quick = generateQuickReview({
          result: gameResult,
          difficulty,
          totalMoves: movesArr.length,
          elapsedMs,
        });
        setCoachFallbackResponse(quick);
        setPhaseState("fallback");
        return;
      }

      const analyzeSource = analyzeSourceRef.current;
      const analyzeRes = await fetch("/api/coach/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gameId: analyzeGameId,
          walletAddress: address,
          locale: activeLocale,
          // Sprint 4 commit F — forward the Peones receipt so the
          // server skips the Redis credit check + decrement when
          // verified.
          ...(peonesIdempotencyKey ? { peonesIdempotencyKey } : {}),
        }),
        signal,
      });
      const analyzeData = analyzeRes.ok ? await analyzeRes.json() as Record<string, unknown> : {};

      // Telemetry: delegate to consumer via onAnalyzeTelemetry callback
      if ((analyzeData as { idempotent?: boolean })?.idempotent === true) {
        // Idempotent hit — no credit consumed
        trackAnalyzeIdempotentHit(analyzeSource);
        onAnalyzeTelemetry?.({ stage: "idempotent_hit", gameId: analyzeGameId, source: analyzeSource });
      } else {
        trackAnalyzeRequest({
          source: analyzeSource,
          gameId: analyzeGameId,
          difficulty,
          moves: movesArr.length,
          result: gameResult,
        });
        onAnalyzeTelemetry?.({ stage: "request", gameId: analyzeGameId, source: analyzeSource });
      }

      const data = analyzeData as {
        status?: string;
        response?: CoachResponse;
        proActive?: boolean;
        historyMeta?: { gamesPlayed?: number };
        locale?: string;
        jobId?: string;
        idempotent?: boolean;
        error?: string;
        internal?: string;
        reason?: string;
      };

      if (data.status === "ready") {
        setCoachResponse(data.response ?? null);
        setCoachAnalysisLocale(
          data.locale === "es" || data.locale === "en"
            ? (data.locale as "en" | "es")
            : undefined,
        );
        setCoachHistoryMeta(
          data.historyMeta
            ? { gamesPlayed: data.historyMeta.gamesPlayed ?? 0 }
            : undefined,
        );
        setCoachReanalyzeGameId(analyzeGameId);
        setCoachCredits((c) => Math.max(0, c - 1));
        setPhaseState("result");
      } else if (data.jobId) {
        setCoachJobId(data.jobId);
        setCoachReanalyzeGameId(analyzeGameId);
        setPhaseState("loading");
      } else {
        if (resolvedProActive) {
          const detail = data.error ?? data.internal ?? data.reason ?? "no detail";
          console.error(
            "[coach] PRO mismatch — server returned non-ready for PRO user:",
            detail,
            `HTTP ${analyzeRes.status}`,
          );
          setCoachServerError("error");
        }
        const quick = generateQuickReview({
          result: gameResult,
          difficulty,
          totalMoves: movesArr.length,
          elapsedMs,
        });
        setCoachFallbackResponse(quick);
        setPhaseState("fallback");
      }
    } catch (err) {
      if (signal.aborted) return; // Reset happened — don't update state
      void err;
      const quick = generateQuickReview({
        result: input.result ?? "lose",
        difficulty: input.difficulty ?? "easy",
        totalMoves: (input.moves ?? []).length,
        elapsedMs: input.elapsedMs ?? 0,
      });
      setCoachFallbackResponse(quick);
      setPhaseState("fallback");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    address,
    activeLocale,
    proActive,
    input.result,
    input.difficulty,
    input.moves,
    input.elapsedMs,
    input.gameId,
    onAnalyzeTelemetry,
  ]);

  // --- askCoach ---
  // Mirrors arena/page.tsx handleAskCoach. Delegates to startCoachAnalysis
  // when the user is connected and past the welcome gate.
  const askCoach = useCallback((source: "immediate" | "victory-mint" | "history" | "viewer" = "immediate") => {
    const movesArr = input.moves ?? [];
    if (movesArr.length === 0) return;

    analyzeSourceRef.current = source as AnalyzeSource;

    // No wallet → free quick review
    if (!isConnected || !address) {
      const quick = generateQuickReview({
        result: input.result ?? "lose",
        difficulty: input.difficulty ?? "easy",
        totalMoves: movesArr.length,
        elapsedMs: input.elapsedMs ?? 0,
      });
      setCoachFallbackResponse(quick);
      setPhaseState("fallback");
      return;
    }

    // PRO subscribers skip the "Meet Your Coach" welcome modal entirely
    if (proActive) {
      try { localStorage.setItem("chesscito:coach-welcomed", "1"); } catch { /* ignore */ }
      void startCoachAnalysis();
      return;
    }

    // First time (free user) → show welcome
    try {
      const welcomed = localStorage.getItem("chesscito:coach-welcomed");
      if (!welcomed) {
        setPhaseState("welcome");
        return;
      }
    } catch { /* localStorage unavailable */ }

    // Returning user → go straight to analysis
    void startCoachAnalysis();
  }, [
    address,
    isConnected,
    proActive,
    input.result,
    input.difficulty,
    input.moves,
    input.elapsedMs,
    startCoachAnalysis,
  ]);

  // --- analyzeFromHistory ---
  // Mirrors arena/page.tsx handleAnalyzeFromHistory.
  const analyzeFromHistory = useCallback(async (gameId: string) => {
    if (!address) return;
    analyzeSourceRef.current = "history";
    setPhaseState("loading");
    const outcome = await requestCoachAnalyze(gameId, address, fetch, activeLocale);

    const isNetworkError = outcome.kind === "error" && outcome.reason === "network_error";
    if (!isNetworkError) {
      const isIdempotent =
        (outcome.kind === "ready" || outcome.kind === "queued") && outcome.idempotent;
      if (isIdempotent) {
        trackAnalyzeIdempotentHit("history");
        onAnalyzeTelemetry?.({ stage: "idempotent_hit", gameId, source: "history" });
      } else {
        trackAnalyzeRequest({ source: "history", gameId });
        onAnalyzeTelemetry?.({ stage: "request", gameId, source: "history" });
      }
    }

    if (outcome.kind === "ready") {
      setCoachResponse(outcome.response);
      setCoachAnalysisLocale(outcome.locale);
      setCoachHistoryMeta(outcome.historyMeta);
      setCoachReanalyzeGameId(gameId);
      setPhaseState("result");
      return;
    }
    if (outcome.kind === "queued") {
      setCoachJobId(outcome.jobId);
      setPhaseState("loading");
      return;
    }
    if (outcome.kind === "paywall") {
      setPhaseState("paywall");
      return;
    }
    // outcome.kind === "error"
    trackAnalyzeFailed({
      source: "history",
      reason: outcome.reason,
      status: outcome.status,
    });
    onAnalyzeTelemetry?.({ stage: "failed", gameId, source: "history" });
    setPhaseState("history");
  }, [address, activeLocale, onAnalyzeTelemetry]);

  // --- reanalyze ---
  // Mirrors arena/page.tsx handleReanalyze.
  const reanalyze = useCallback(async () => {
    if (!address || !coachReanalyzeGameId) return;
    setIsReanalyzing(true);
    try {
      const outcome = await requestCoachAnalyze(
        coachReanalyzeGameId,
        address,
        fetch,
        activeLocale,
        { forceLocale: true },
      );
      if (outcome.kind === "ready") {
        setCoachResponse(outcome.response);
        setCoachAnalysisLocale(outcome.locale ?? activeLocale);
        setCoachHistoryMeta(outcome.historyMeta);
        setCoachCredits((c) => Math.max(0, c - 1));
        return;
      }
      if (outcome.kind === "queued") {
        setCoachJobId(outcome.jobId);
        setPhaseState("loading");
        return;
      }
      if (outcome.kind === "paywall") {
        setPhaseState("paywall");
        return;
      }
      // outcome.kind === "error" — surface for triage; UI stays on result phase
      trackAnalyzeFailed({
        source: "history",
        reason: outcome.reason,
        status: outcome.status,
      });
    } finally {
      setIsReanalyzing(false);
    }
  }, [address, coachReanalyzeGameId, activeLocale]);

  // --- claimWelcome ---
  // Mirrors arena/page.tsx handleClaimWelcome (lines 772-776).
  // Owns the chesscito:coach-welcomed localStorage write per spec migration rule #4.
  const claimWelcome = useCallback(async () => {
    try { localStorage.setItem("chesscito:coach-welcomed", "1"); } catch { /* ignore */ }
    setPhaseState("idle");
    await startCoachAnalysis();
  }, [startCoachAnalysis]);

  // --- abort ---
  const abort = useCallback(() => {
    coachAbortRef.current?.abort();
  }, []);

  return {
    phase,
    response: coachResponse,
    fallbackResponse: coachFallbackResponse,
    jobId: coachJobId,
    credits: coachCredits,
    analysisLocale: coachAnalysisLocale,
    reanalyzeGameId: coachReanalyzeGameId,
    isReanalyzing,
    serverError: coachServerError,
    historyMeta: coachHistoryMeta,
    setPhase,
    askCoach,
    analyzeFromHistory,
    reanalyze,
    claimWelcome,
    abort,
  };
}
