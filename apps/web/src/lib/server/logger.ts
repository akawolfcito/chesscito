/**
 * Structured server-side logger for Vercel Functions.
 *
 * Emits one JSON line per call to stderr (errors) or stdout (info/warn) so the
 * Vercel Runtime Logs panel can filter by `level=error route=/api/x`. Designed
 * as a thin seam: when we add an external tracker (Sentry / Axiom / Better
 * Stack), we swap the default sink without touching call sites.
 *
 * Hard rules:
 *   - Never auto-spread request bodies / headers. Caller picks ctx fields.
 *   - Redact ctx keys whose names match known secret patterns (defense in
 *     depth, not the primary control — call sites must still avoid passing
 *     secrets).
 *   - Never throw. A logger that crashes the request handler is worse than
 *     no logger.
 *   - Noop in vitest by default so route tests don't pollute stderr.
 */

import { createHash } from "node:crypto";

export type LogLevel = "info" | "warn" | "error";

type CtxValue = string | number | boolean | bigint | null | undefined | object;
export type LogContext = Record<string, CtxValue>;

export interface Logger {
  info(message: string, ctx?: LogContext): void;
  warn(message: string, ctx?: LogContext): void;
  error(message: string, ctx?: LogContext): void;
}

type Sink = (line: string, level: LogLevel) => void;

const SECRET_KEY_RE = /key|secret|token|signer|dragon|torre|service[_-]?role|mnemonic|seed|passphrase|password/i;

const defaultSink: Sink = (line, level) => {
  if (process.env.VITEST || process.env.NODE_ENV === "test") return;
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
};

let activeSink: Sink = defaultSink;

/** Test hook: route lines into a custom sink. */
export function __setLoggerSink(sink: Sink): void {
  activeSink = sink;
}

/** Test hook: restore the default stderr/stdout sink. */
export function __resetLoggerSink(): void {
  activeSink = defaultSink;
}

function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}

function redactCtx(ctx: LogContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(ctx)) {
    out[key] = SECRET_KEY_RE.test(key) ? "[REDACTED]" : value;
  }
  return out;
}

function safeStringify(record: Record<string, unknown>): string {
  try {
    return JSON.stringify(record, bigIntReplacer);
  } catch (err) {
    const fallback = {
      level: record.level,
      route: record.route,
      msg: record.msg,
      timestamp: record.timestamp,
      ctxError: err instanceof Error ? err.message : "stringify failed",
    };
    try {
      return JSON.stringify(fallback);
    } catch {
      return `{"level":"error","msg":"logger-failed"}`;
    }
  }
}

function emit(scope: { route: string }, level: LogLevel, message: string, ctx?: LogContext): void {
  const record: Record<string, unknown> = {
    level,
    msg: message,
    route: scope.route,
    timestamp: new Date().toISOString(),
  };
  if (ctx) {
    Object.assign(record, redactCtx(ctx));
  }
  const line = safeStringify(record);
  try {
    activeSink(line, level);
  } catch {
    // Last-resort: never propagate sink errors to the request handler.
  }
}

export function createLogger(scope: { route: string }): Logger {
  return {
    info: (message, ctx) => emit(scope, "info", message, ctx),
    warn: (message, ctx) => emit(scope, "warn", message, ctx),
    error: (message, ctx) => emit(scope, "error", message, ctx),
  };
}

/**
 * Stable, non-reversible 16-hex-char identifier for a wallet, suitable for
 * log lines. Combines the lowercased wallet with the server-side `LOG_SALT`
 * secret and returns the 64-bit prefix of the sha256 digest.
 *
 * Spec §8.4 / §12 / red-team P1-8.
 *
 * **Secrecy contract**: `LOG_SALT` is rotated quarterly per the runbook
 * (PR 5 lands `docs/runbooks/log-salt-rotation.md`). It MUST NOT be
 * `NEXT_PUBLIC_*`; without secrecy, an attacker with log read access can
 * rainbow-table known wallet addresses. The "stable but non-reversible"
 * guarantee is contractual — if the salt leaks, treat all in-flight log
 * lines containing wallet hashes as deanonymizable until the salt rotates.
 *
 * **Misconfig fallback** (2026-05-07): when `LOG_SALT` is missing the
 * function used to throw, which propagated through structured-log
 * helpers and crashed downstream routes (real incident on
 * /api/coach/analyze when the env var was deployed under the wrong
 * key). It now returns the literal `"unsalted"` and emits a one-shot
 * console.warn so the misconfiguration is loud in stderr without
 * taking down the request handler. The placeholder is intentionally
 * not a hash so it can't be mistaken for a valid identifier during a
 * log scan.
 */
let unsaltedWarnedOnce = false;

export function hashWallet(wallet: string): string {
  const salt = process.env.LOG_SALT;
  if (!salt) {
    if (!unsaltedWarnedOnce) {
      unsaltedWarnedOnce = true;
      console.warn(
        "[hashWallet] LOG_SALT env is missing — emitting 'unsalted' placeholder for wallet_hash log lines. Set LOG_SALT in the deployment environment to restore the privacy property.",
      );
    }
    return "unsalted";
  }
  return createHash("sha256")
    .update(wallet.toLowerCase() + salt)
    .digest("hex")
    .slice(0, 16);
}
