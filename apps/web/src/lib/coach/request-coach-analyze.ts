import type { CoachResponse } from "@/lib/coach/types";
import type { CoachLocale } from "@/lib/coach/prompt-template";

export type AnalyzeOutcome =
  | {
      kind: "ready";
      response: CoachResponse;
      proActive: boolean;
      historyMeta: { gamesPlayed: number } | undefined;
      idempotent: boolean;
    }
  | { kind: "queued"; jobId: string; idempotent: boolean }
  | { kind: "paywall" }
  | { kind: "error"; reason: "network_error" | "server_error" | "parse_error" | "no_payload"; status?: number };

type RawAnalyzeResponse = {
  status?: string;
  response?: CoachResponse;
  proActive?: boolean;
  historyMeta?: { gamesPlayed?: number };
  jobId?: string;
  idempotent?: boolean;
};

export async function requestCoachAnalyze(
  gameId: string,
  walletAddress: string,
  fetchImpl: typeof fetch = fetch,
  locale?: CoachLocale,
): Promise<AnalyzeOutcome> {
  // H-4: locale is optional + omitted from the body when undefined so
  // pre-locale callers (legacy MiniPay clients in production) keep their
  // bit-identical request signature. The server defaults to "en" when
  // the field is absent.
  const body =
    locale !== undefined
      ? { gameId, walletAddress, locale }
      : { gameId, walletAddress };
  let res: Response;
  try {
    res = await fetchImpl("/api/coach/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "error", reason: "network_error" };
  }

  if (res.status === 402) return { kind: "paywall" };

  if (!res.ok) {
    return { kind: "error", reason: "server_error", status: res.status };
  }

  let data: RawAnalyzeResponse;
  try {
    data = (await res.json()) as RawAnalyzeResponse;
  } catch {
    return { kind: "error", reason: "parse_error", status: res.status };
  }

  if (data?.status === "ready" && data.response) {
    return {
      kind: "ready",
      response: data.response,
      proActive: data.proActive === true,
      historyMeta: data.historyMeta
        ? { gamesPlayed: data.historyMeta.gamesPlayed ?? 0 }
        : undefined,
      idempotent: data.idempotent === true,
    };
  }
  if (typeof data?.jobId === "string" && data.jobId.length > 0) {
    return { kind: "queued", jobId: data.jobId, idempotent: data.idempotent === true };
  }
  return { kind: "error", reason: "no_payload", status: res.status };
}
