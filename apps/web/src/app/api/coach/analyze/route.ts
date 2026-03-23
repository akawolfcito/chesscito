import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import OpenAI from "openai";
import { isAddress } from "viem";
import { validateGameRecord } from "@/lib/coach/validate-game";
import { normalizeCoachResponse } from "@/lib/coach/normalize";
import { buildCoachPrompt } from "@/lib/coach/prompt-template";
import { REDIS_KEYS } from "@/lib/coach/redis-keys";
import type { GameRecord, CoachAnalysisRecord, PlayerSummary } from "@/lib/coach/types";

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

    // --- Free tier: seed 3 credits on first use (atomic) ---
    const FREE_CREDITS = 3;
    const seededKey = `coach:seeded:${wallet}`;
    const wasSet = await redis.setnx(seededKey, "1");
    if (wasSet) {
      await redis.setnx(REDIS_KEYS.credits(wallet), FREE_CREDITS);
    }

    // --- Credit check ---
    const credits = (await redis.get<number>(REDIS_KEYS.credits(wallet))) ?? 0;
    if (credits <= 0) {
      return NextResponse.json({ error: "No credits available" }, { status: 402 });
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
    await redis.set(REDIS_KEYS.job(jobId), { status: "pending" }, { ex: 60 });
    await redis.set(REDIS_KEYS.jobByGame(wallet, gameId), jobId, { ex: 60 });
    await redis.set(REDIS_KEYS.pendingJob(wallet), jobId, { ex: 60 });

    // --- Build prompt ---
    const playerSummary = await redis.get<PlayerSummary>(`coach:summary:${wallet}`);
    const prompt = buildCoachPrompt(
      gameRecord.moves,
      validation.computedResult,
      gameRecord.difficulty,
      playerSummary,
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
        redis.decr(REDIS_KEYS.credits(wallet)),
        redis.set(REDIS_KEYS.job(jobId), { status: "ready", response: normalized.data }, { ex: 30 * 24 * 60 * 60 }),
        redis.del(REDIS_KEYS.pendingJob(wallet)),
      ]);

      return NextResponse.json({ status: "ready", response: normalized.data });
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
