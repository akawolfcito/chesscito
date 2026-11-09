/**
 * Credential loading for the monitor.
 *
 * Two rules, both absolute:
 *   1. Values are read into memory and NEVER returned to any renderer. The only
 *      thing that leaves this module for display is a boolean per credential.
 *   2. Nothing here throws on a missing credential. A monitor whose job is to
 *      report degraded state must not itself fall over when a provider is
 *      unconfigured — that is what `not_observable` is for.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

/** Env files searched, later ones winning. Real `process.env` beats both. */
const ENV_FILES = [".env.local", "apps/web/.env.local"] as const;

export type CredentialName =
  | "SUPABASE_URL"
  | "SUPABASE_DB_PASSWORD"
  | "UPSTASH_REDIS_REST_URL"
  | "UPSTASH_REDIS_REST_TOKEN"
  | "UPSTASH_EMAIL"
  | "UPSTASH_API_KEY"
  | "VERCEL_TOKEN"
  | "LOG_SALT";

/** What the report is allowed to say about a credential. */
export type CredentialStatus = { name: CredentialName; configured: boolean };

export type OpsEnv = {
  get(name: CredentialName): string | undefined;
  has(name: CredentialName): boolean;
  /** Presence-only view. This is the ONLY shape that may be rendered. */
  statuses(): CredentialStatus[];
};

const ALL: CredentialName[] = [
  "SUPABASE_URL",
  "SUPABASE_DB_PASSWORD",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "UPSTASH_EMAIL",
  "UPSTASH_API_KEY",
  "VERCEL_TOKEN",
  "LOG_SALT",
];

function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of contents.split("\n")) {
    const match = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/);
    if (!match) continue;
    out[match[1]!] = match[2]!.replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

export function loadOpsEnv(repoRoot: string): OpsEnv {
  const values: Record<string, string> = {};

  for (const file of ENV_FILES) {
    try {
      Object.assign(values, parseEnvFile(readFileSync(path.join(repoRoot, file), "utf8")));
    } catch {
      // Absent env file is normal (CI, a fresh clone). Not an error.
    }
  }
  // A real environment variable always wins over a file.
  for (const name of ALL) {
    const fromProcess = process.env[name];
    if (fromProcess) values[name] = fromProcess;
  }

  return {
    get: (name) => values[name] || undefined,
    has: (name) => Boolean(values[name]),
    statuses: () => ALL.map((name) => ({ name, configured: Boolean(values[name]) })),
  };
}

/**
 * Supabase project ref, parsed out of the URL.
 *
 * The ref is not secret (it is the public hostname) but it is not printed
 * either: nothing downstream needs it, and keeping it out of the report means
 * one less thing to review when someone shares a snapshot.
 */
export function parseSupabaseRef(url: string | undefined): string | undefined {
  const match = (url ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match?.[1];
}
