/**
 * GET /api/inbox?wallet=0x…   → the player's messages + unread count
 * PATCH /api/inbox            → mark one message read  { wallet, id }
 *
 * ⛔ The service role lives HERE and only here. `inbox_messages` denies anon and
 * authenticated outright, so a browser cannot reach the table; this route is the
 * whole surface, and it filters by the wallet in the request.
 *
 * ⚠️ HONEST ABOUT WHAT THIS IS NOT. Knowing a wallet is enough to read its
 * inbox — the same model `/api/peones/balance` already uses. Acceptable while
 * the inbox carries no secrets and nothing claimable. The day it carries a
 * claim, it needs what the duel seat has: a non-guessable credential issued by
 * the server. Written down so that decision is never taken by omission.
 *
 * Spec: docs/specs/2026-08-25-inbox-v0-review.md
 */

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { isInboxMessageType, type InboxMessage } from "@/lib/inbox/types";
import { normalizeWallet } from "@/lib/peones/ledger-service";

import { enforceOrigin } from "@/lib/server/demo-signing";
import { createLogger } from "@/lib/server/logger";
import { getSupabaseServer } from "@/lib/supabase/server";

const log = createLogger({ route: "/api/inbox" });
/**
 * ⛔ `normalizeWallet` THROWS on a malformed address, it does not return empty.
 * Calling it bare turned "?wallet=nope" into a 500 — an input error reported as
 * a server fault, which is both wrong and noisy in the logs. Caught by smoking
 * the endpoint, not by any test.
 */
function safeWallet(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    return normalizeWallet(raw);
  } catch {
    return null;
  }
}

/** Never echo a Supabase message: it can quote the offending row, which on this
 *  table means a wallet. A fixed vocabulary is enough to read the logs. */
function classify(message: string | undefined): string {
  if (!message) return "unknown";
  const head = message.slice(0, 200).toLowerCase();
  if (head.includes("<!doctype html") || head.includes("<html")) {
    return "html_gateway_error";
  }
  if (head.includes("timeout")) return "timeout";
  return "db_error";
}

type Row = {
  id: string;
  type: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_href: string | null;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
};

/** Row → what the client sees. Drops `wallet` (the caller already knows whose
 *  inbox it asked for) and `expires_at` (already applied). */
function toMessage(row: Row): InboxMessage | null {
  if (!isInboxMessageType(row.type)) return null;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wallet = safeWallet(url.searchParams.get("wallet"));
  if (!wallet) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }

  const supabase = getSupabaseServer({ freshReads: true });
  if (!supabase) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("inbox_messages")
    .select(
      "id, type, title, body, cta_label, cta_href, read_at, created_at, expires_at",
    )
    .eq("wallet", wallet)
    // Expiry is applied on READ rather than by deleting rows: a message that
    // vanished from a player's screen is still something we may have to explain.
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    log.error("inbox_read_failed", { reason: classify(error.message) });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const messages = ((data ?? []) as Row[])
    .map(toMessage)
    .filter((m): m is InboxMessage => m !== null);

  return NextResponse.json({
    messages,
    unreadCount: messages.reduce((n, m) => (m.readAt === null ? n + 1 : n), 0),
  });
}

export async function PATCH(request: Request) {
  // ⚠️ `enforceOrigin` THROWS, it does not return an error — same shape every
  // other route uses (sign-victory, sign-score, pro/status).
  try {
    enforceOrigin(request);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    wallet?: unknown;
    id?: unknown;
  };

  const wallet = safeWallet(body.wallet);
  if (!wallet) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  if (typeof body.id !== "string" || body.id.length === 0) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const supabase = getSupabaseServer({ freshReads: true });
  if (!supabase) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  /* ⛔ BOTH `id` AND `wallet` IN THE FILTER. Matching on the id alone would let
   * anyone who guessed a uuid mark somebody else's message read. Ownership is
   * part of the WHERE, not a check somebody remembers to write above it.
   *
   * ⚠️ `is("read_at", null)` keeps this idempotent: a double tap, or a retry
   * after a flaky response, must not move the timestamp a second time. */
  const { data, error } = await supabase
    .from("inbox_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("wallet", wallet)
    .is("read_at", null)
    .select("id");

  if (error) {
    log.error("inbox_mark_read_failed", { reason: classify(error.message) });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  // Zero rows means it was already read, or is not this wallet's. Both are `ok`
  // from the caller's side: the message is read and the badge should drop.
  return NextResponse.json({ ok: true, updated: (data ?? []).length });
}
