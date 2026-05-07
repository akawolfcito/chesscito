import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import OpenAI from "openai";
import { isAddress } from "viem";
import { validateGameRecord } from "@/lib/coach/validate-game";
import { normalizeCoachResponse } from "@/lib/coach/normalize";
import { buildCoachPrompt } from "@/lib/coach/prompt-template";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import { isProActive } from "@/lib/pro/is-active";
import { aggregateHistory } from "@/lib/coach/history-digest";
import { backfillRedisToSupabase } from "@/lib/coach/backfill";
import { persistAnalysis } from "@/lib/coach/persistence";
import { createLogger, hashWallet } from "@/lib/server/logger";
import { enforceOrigin, enforceRateLimit, getRequestIp } from "@/lib/server/demo-signing";
import type { GameRecord, CoachAnalysisRecord, PlayerSummary, HistoryDigest } from "@/lib/coach/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const redis = Redis.fromEnv();

const MODEL = process.env.COACH_LLM_MODEL ?? "gpt-4o-mini";
const BASE_URL = process.env.COACH_LLM_BASE_URL ?? "https://api.openai.com/v1";
const MAX_OUTPUT_TOKENS = 1500;
const LLM_TIMEOUT_MS = 45_000;
const ANALYSIS_VERSION = "1.0.0";

const llm = process.env.COACH_LLM_API_KEY
  ? new OpenAI({ apiKey: process.env.COACH_LLM_API_KEY, baseURL: BASE_URL })
  : null;

export async function POST(req: Request) {
  try {
    enforceOrigin(req);
    const ip = getRequestIp(req);
    await enforceRateLimit(ip);

    const body = await req.json();
    const { gameId, walletAddress } = body as { gameId?: string; walletAddress?: string };

    if (!gameId || !walletAddress) {
      return NextResponse.json({ error: "Missing gameId or walletAddress" }, { status: 400 });
    }
    if (!isAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }
    if (!UUID_RE.test(gameId)) {
      return NextResponse.json({ error: "Invalid gameId format" }, { status: 400 });
    }

    const wallet = walletAddress.toLowerCase();

    // --- Idempotency: existing result? ---
    const existingAnalysis = await redis.get<CoachAnalysisRecord>(REDIS_KEYS.analysis(wallet, gameId));
    if (existingAnalysis) {
      return NextResponse.json({ status: "ready", response: existingAnalysis.response });
    }

    // --- Idempotency: pending job? ---
    const existingJobId = await redis.get<string>(REDIS_KEYS.jobByGame(wallet, gameId));
    if (existingJobId) {
      return NextResponse.json({ jobId: existingJobId });
    }

    // --- Rate limit: 1 pending job per wallet ---
    const pendingJobId = await redis.get<string>(REDIS_KEYS.pendingJob(wallet));
    if (pendingJobId) {
      return NextResponse.json({ error: "An analysis is already in progress" }, { status: 429 });
    }

    // --- Free tier: seed 3 credits on first use (atomic Lua script — no race window) ---
    const FREE_CREDITS = 3;
    await redis.eval(
      `local s = redis.call("SETNX", KEYS[1], "1")
       if s == 1 then redis.call("SETNX", KEYS[2], ARGV[1]) end
       return s`,
      [`coach:seeded:${wallet}`, REDIS_KEYS.credits(wallet)],
      [FREE_CREDITS],
    );

    // --- Chesscito PRO bypass: capture-once at the top of the request.
    // If PRO is active we skip the credit read and the credit decrement
    // entirely. The decision is honored to the end of the request even
    // if PRO expires mid-LLM-call — paying customers always finish the
    // analysis they started. ---
    const proStatus = await isProActive(wallet);

    const log = createLogger({ route: "/api/coach/analyze" });

    // PRO read path — backfill once, aggregate, augment prompt. Free
    // path skips this entirely; locked by the prompt-template free-path
    // inline snapshot.
    let history: HistoryDigest | null = null;
    if (proStatus.active) {
      try {
        await backfillRedisToSupabase(wallet, log);
        history = await aggregateHistory(wallet);
        log.info("coach_history_aggregated", {
          wallet_hash: hashWallet(wallet),
          pro_active: true,
          depth: history?.gamesPlayed ?? 0,
          top_tags_count: history?.topWeaknessTags.length ?? 0,
        });
      } catch (err) {
        // Fail-soft per §6.5 — degraded analysis (no augmentation) is
        // better than 500. The free-tier prompt is bit-identical to the
        // path the LLM has been receiving since launch.
        history = null;
        log.warn("coach_history_read_failed", {
          wallet_hash: hashWallet(wallet),
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // --- Credit check (skipped for PRO) ---
    if (!proStatus.active) {
      const credits = (await redis.get<number>(REDIS_KEYS.credits(wallet))) ?? 0;
      if (credits <= 0) {
        return NextResponse.json({ error: "No credits available" }, { status: 402 });
      }
    } else {
      // Server-side telemetry — Vercel logs only for now. No PII: we
      // emit the expiresAt timestamp (already client-visible) and skip
      // the wallet entirely. TODO: replace with a real
      // lib/server/telemetry helper that batches into analytics_events
      // once we have one (see commit 8 brief).
      console.info("[pro-bypass] coach analyze short-circuited", {
        event: "coach_pro_bypass_used",
        pro_expires_at: proStatus.expiresAt,
      });
    }

    // --- Fetch game record ---
    const gameRecord = await redis.get<GameRecord>(REDIS_KEYS.game(wallet, gameId));
    if (!gameRecord) {
      return NextResponse.json({ error: "Game record not found" }, { status: 404 });
    }

    // --- Validate game ---
    const validation = validateGameRecord({
      moves: gameRecord.moves,
      result: gameRecord.result,
      difficulty: gameRecord.difficulty,
    });
    if (!validation.valid) {
      return NextResponse.json({ error: `Invalid game: ${validation.error}` }, { status: 400 });
    }

    // --- Check LLM availability ---
    if (!llm) {
      return NextResponse.json({ error: "Coach is not configured" }, { status: 503 });
    }

    // --- Create job ---
    const jobId = crypto.randomUUID();
    await redis.set(REDIS_KEYS.job(jobId), { status: "pending", wallet }, { ex: 60 });
    await redis.set(REDIS_KEYS.jobByGame(wallet, gameId), jobId, { ex: 60 });
    await redis.set(REDIS_KEYS.pendingJob(wallet), jobId, { ex: 60 });

    // --- Build prompt ---
    const playerSummary = await redis.get<PlayerSummary>(`coach:summary:${wallet}`);
    const prompt = buildCoachPrompt(
      gameRecord.moves,
      validation.computedResult,
      gameRecord.difficulty,
      playerSummary,
      history,
    );

    // --- Call LLM ---
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

      const completion = await llm.chat.completions.create(
        {
          model: MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          messages: [{ role: "user", content: prompt }],
        },
        { signal: controller.signal },
      );

      clearTimeout(timeout);

      const text = completion.choices[0]?.message?.content ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in LLM response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const normalized = normalizeCoachResponse(parsed);

      if (!normalized.success) {
        throw new Error(`Normalization failed: ${normalized.error}`);
      }

      // --- Success: store result, decrement credit ---
      const analysisRecord: CoachAnalysisRecord = {
        gameId,
        provider: "server",
        model: MODEL,
        analysisVersion: ANALYSIS_VERSION,
        createdAt: Date.now(),
        response: normalized.data,
      };

      await Promise.all([
        redis.set(REDIS_KEYS.analysis(wallet, gameId), analysisRecord, { ex: 30 * 24 * 60 * 60 }),
        redis.lpush(REDIS_KEYS.analysisList(wallet), gameId),
        ...(proStatus.active ? [] : [redis.decr(REDIS_KEYS.credits(wallet))]),
        redis.set(REDIS_KEYS.job(jobId), { status: "ready", response: normalized.data }, { ex: 30 * 24 * 60 * 60 }),
        redis.del(REDIS_KEYS.pendingJob(wallet)),
      ]);

      // PRO write-through. Fail-soft per §6.1 — never block the user-
      // visible analysis the user already paid for. Only triggers for
      // kind='full' since v1 doesn't store BasicCoachResponse rows.
      if (proStatus.active && normalized.data.kind === "full") {
        try {
          const { tagError } = await persistAnalysis(wallet, {
            gameId,
            difficulty: gameRecord.difficulty,
            result: validation.computedResult,
            totalMoves: validation.totalMoves,
            response: normalized.data,
          });
          if (tagError) {
            log.warn("coach_tag_extraction_failed", {
              wallet_hash: hashWallet(wallet),
              phase: "live",
              err: tagError.message,
            });
          }
        } catch (err) {
          log.warn("coach_persist_failed", {
            wallet_hash: hashWallet(wallet),
            game_id: gameId,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return NextResponse.json({
        status: "ready",
        response: normalized.data,
        ...(proStatus.active
          ? {
              proActive: true,
              historyMeta: { gamesPlayed: history?.gamesPlayed ?? 0 },
            }
          : {}),
      });
    } catch (err) {
      const internal = err instanceof Error ? err.message : "Unknown error";
      const reason = "Analysis failed, please retry";

      await Promise.all([
        redis.set(REDIS_KEYS.job(jobId), { status: "failed", reason, internal }, { ex: 24 * 60 * 60 }),
        redis.del(REDIS_KEYS.pendingJob(wallet)),
        redis.del(REDIS_KEYS.jobByGame(wallet, gameId)),
      ]);

      return NextResponse.json({ status: "failed", reason }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
