"use client";

import { useCallback, useRef, useState } from "react";
import type { CoachResponse, BasicCoachResponse } from "./types";

export type CoachPhase = "idle" | "loading" | "review" | "result" | "fallback" | "paywall" | "welcome" | "history";

export type CoachAnalysisInjected = {
  address?: `0x${string}`;
  chainId?: number;
  proActive?: boolean;
  activeLocale?: "en" | "es";
};

export type CoachAnalysisInput = {
  gameId?: string;
  walletAddress?: `0x${string}`;
  result?: "win" | "lose" | "draw" | "resigned";
  difficulty?: "easy" | "medium" | "hard";
  moves?: string[];
  elapsedMs?: number;
  surface: "arena_endgame" | "coach_viewer";
  injected?: CoachAnalysisInjected;
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
  setPhase: (p: CoachPhase) => void;
  askCoach: (source?: "immediate" | "victory-mint" | "history" | "viewer") => void;
  analyzeFromHistory: (gameId: string) => void;
  reanalyze: () => Promise<void>;
  claimWelcome: () => Promise<void>;
  abort: () => void;
};

/**
 * Coach phase machine — SKELETON. Real logic is transplanted from
 * arena/page.tsx in commit T5b. This stub satisfies the interface
 * and is referentially stable across renders so consumer effects
 * can list it in deps without thrashing. Behind feature flag
 * NEXT_PUBLIC_USE_EXTRACTED_COACH_HOOKS — default OFF, legacy
 * inline path in arena/page.tsx is the source of truth until T5b.
 *
 * @remarks
 * Single-game-mount expectation: this hook's currentIndex-style
 * state initializes on mount and does not auto-reset when input
 * identity changes. Pass `key={gameId}` to force remount between
 * games.
 */
export function useCoachAnalysis(_input: CoachAnalysisInput): CoachAnalysisState {
  const [phase, setPhase] = useState<CoachPhase>("idle");
  const abortRef = useRef<AbortController | null>(null);

  const setPhaseStable = useCallback((p: CoachPhase) => setPhase(p), []);
  const askCoach = useCallback((_source?: "immediate" | "victory-mint" | "history" | "viewer") => {
    // STUB: real impl transplants startCoachAnalysis + handleAskCoach
    // from arena/page.tsx:495-696 in T5b.
  }, []);
  const analyzeFromHistory = useCallback((_gameId: string) => {
    // STUB: real impl transplants handleAnalyzeFromHistory in T5b.
  }, []);
  const reanalyze = useCallback(async () => {
    // STUB
  }, []);
  const claimWelcome = useCallback(async () => {
    // STUB: real impl transplants handleClaimWelcome (lines 759-763) in T5b.
  }, []);
  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    phase,
    response: null,
    fallbackResponse: null,
    jobId: null,
    credits: 0,
    analysisLocale: undefined,
    reanalyzeGameId: null,
    isReanalyzing: false,
    serverError: null,
    setPhase: setPhaseStable,
    askCoach,
    analyzeFromHistory,
    reanalyze,
    claimWelcome,
    abort,
  };
}
