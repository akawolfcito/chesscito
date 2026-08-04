import { getSupabaseServer } from "@/lib/supabase/server";
import { deriveAccountRef } from "@/lib/analytics/account-ref";
import { afterResponse } from "@/lib/server/after-response";
import {
  normalizeAppVersion,
  normalizeCampaign,
  normalizeContainer,
  normalizeCountry,
  normalizeLocale,
  normalizeSource,
  normalizeSurface,
} from "@/lib/analytics/dimensions";

export const runtime = "nodejs";

/**
 * Payload limits. Every one of these is enforced BEFORE the Supabase client is
 * even constructed — an oversized or malformed request must cost the database
 * nothing. That ordering is the point of this block, not a detail: during the
 * 522 incident the cheapest possible response to bad input is one that never
 * reaches the origin.
 *
 * Rejections are silent by design. This route has NO request logging: echoing
 * an invalid payload into the log drain would put raw wallet addresses there,
 * which is exactly the leak `account_ref` exists to prevent. We log neither the
 * body nor a truncated sample of it.
 */

/** Whole request body, serialized. */
const MAX_BODY_BYTES = 64 * 1024;
/** One event, serialized. */
const MAX_EVENT_BYTES = 8 * 1024;
/** Events per request. Matches the client's flush size exactly — a larger
 *  batch is not a client of ours, so it is refused rather than truncated.
 *  Truncating would silently discard events while answering 204. */
const MAX_BATCH = 20;

const MAX_EVENT_LEN = 64;
const MAX_SESSION_LEN = 64;
const MAX_PROPS_BYTES = 4_096;
const MAX_VISIT_LEN = 64;
/** Any single dimension value. They are allow-listed anyway, but an explicit
 *  ceiling keeps a megabyte string from reaching the normalizers at all. */
const MAX_DIM_LEN = 128;
/** Any single string value inside `props`. */
const MAX_PROP_STRING_LEN = 512;
const MAX_PROP_KEY_LEN = 40;

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

type EventPayload = {
  session_id?: unknown;
  event?: unknown;
  props?: unknown;
  dims?: unknown;
  /** Raw connected address. Consumed here and replaced by a keyed pseudonym —
   *  never persisted, never logged, never echoed back. */
  account?: unknown;
};

/**
 * Wire format. Two shapes on purpose:
 *
 *   { session_id, event, props, dims, account }   ← pre-Fase-1 single event
 *   { events: [ …the same objects… ] }            ← batched
 *
 * The single form is NOT legacy cruft to remove later: browsers cache the JS
 * bundle, so for as long as any tab is running the old client it will keep
 * posting single events. Dropping it would silently lose their telemetry.
 */
type Payload = EventPayload & { events?: unknown };

/** Server-authoritative dimensions written to analytics_events. Every value is
 *  re-sanitized through the shared allow-lists (the client already stamped
 *  them, but the server is the source of truth) and `country` is derived here
 *  from the edge header — never trusted from the client. */
type ServerDims = {
  surface: string | null;
  container: string | null;
  locale: string | null;
  country: string | null;
  source: string | null;
  campaign: string | null;
  app_version: string | null;
  visit_id: string | null;
};

/** Oversized dimension values are dropped to null rather than rejected: they
 *  are cosmetic, allow-listed, and losing one must not cost the event. */
function cap(value: unknown): unknown {
  if (typeof value === "string" && value.length > MAX_DIM_LEN) return null;
  return value;
}

function sanitizeDims(raw: unknown, country: string | null): ServerDims {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const visit =
    typeof d.visit_id === "string" && d.visit_id.length <= MAX_VISIT_LEN
      ? d.visit_id
      : null;
  return {
    surface: normalizeSurface(cap(d.surface)),
    container: normalizeContainer(cap(d.container)),
    locale: normalizeLocale(cap(d.locale)),
    country, // from edge header only
    source: normalizeSource(cap(d.source)),
    campaign: normalizeCampaign(cap(d.campaign)),
    app_version: normalizeAppVersion(cap(d.app_version)),
    visit_id: visit,
  };
}

/**
 * `null` = no props. `"reject"` = the props blew a limit and the whole EVENT is
 * dropped.
 *
 * Oversized props used to be silently coerced to `null` and the event written
 * anyway. That is worse than dropping it: the row survives with its payload
 * missing, so the event looks recorded and is not. Better to lose it loudly in
 * the count than to keep a lie.
 */
function sanitizeProps(
  raw: unknown,
): Record<string, unknown> | null | "reject" {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return "reject";
  try {
    if (byteLength(JSON.stringify(raw)) > MAX_PROPS_BYTES) return "reject";
  } catch {
    return "reject";
  }
  // Strip any nested objects beyond 2 levels + coerce primitives.
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key.length > MAX_PROP_KEY_LEN) continue;
    if (typeof value === "string") {
      if (value.length > MAX_PROP_STRING_LEN) return "reject";
      out[key] = value;
    } else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value == null
    ) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Both wire shapes, normalized to a list — or `"too-large"` when a payload
 * limit is blown, which the caller turns into a 413.
 *
 * The single-event shape is held to the SAME size limits as a batch entry: an
 * old cached bundle is still a client we accept, not a client we trust.
 */
function readEvents(payload: Payload): EventPayload[] | "too-large" {
  const list: unknown[] = Array.isArray(payload.events)
    ? payload.events
    : typeof payload.event === "string"
      ? [payload]
      : [];

  if (list.length > MAX_BATCH) return "too-large";

  const events: EventPayload[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    try {
      if (byteLength(JSON.stringify(raw)) > MAX_EVENT_BYTES) return "too-large";
    } catch {
      continue; // unserializable (cycles) — skip the event, keep the batch
    }
    events.push(raw as EventPayload);
  }
  return events;
}

/** 413 with no body. Nothing about the offending payload is echoed or logged —
 *  see the limits block. */
function tooLarge(): Response {
  return new Response(null, { status: 413 });
}

type AnalyticsRow = ServerDims & {
  session_id: string;
  event: string;
  props: Record<string, unknown> | null;
  account_ref: string | null;
};

export async function POST(req: Request) {
  // Fire-and-forget from the client — always 204 so UI never blocks on
  // analytics. Sanitize + validate, drop silently on any failure.
  try {
    // Read as TEXT first: the body's own size is the cheapest limit to check,
    // and it is checked before parsing, before validating, and long before the
    // Supabase client exists.
    const raw = await req.text();
    if (byteLength(raw) > MAX_BODY_BYTES) return tooLarge();

    let payload: Payload;
    try {
      payload = JSON.parse(raw) as Payload;
    } catch {
      return new Response(null, { status: 204 });
    }

    // Country comes ONLY from the edge geo header — never from the client
    // payload. We keep ISO alpha-2 and nothing else: no IP, city, region,
    // postal code, or coordinates is ever read or stored (privacy §7). One
    // header per request, so it is resolved once for the whole batch.
    const country = normalizeCountry(req.headers.get("x-vercel-ip-country"));

    const rows: AnalyticsRow[] = [];
    /** Sessions whose batch contained `app_opened` — the retention cohort. */
    const firstSeenSessions = new Map<string, ServerDims>();
    /** Accounts seen anywhere in the batch — the account cohort. */
    const firstSeenAccounts = new Map<string, ServerDims>();

    const events = readEvents(payload);
    if (events === "too-large") return tooLarge();

    for (const raw of events) {
      const sessionId =
        typeof raw.session_id === "string" ? raw.session_id : "";
      const event = typeof raw.event === "string" ? raw.event : "";
      if (!sessionId || !event) continue;
      if (sessionId.length > MAX_SESSION_LEN || event.length > MAX_EVENT_LEN) {
        continue;
      }

      const props = sanitizeProps(raw.props);
      if (props === "reject") continue;

      const dims = sanitizeDims(raw.dims, country);

      // Wallet in, keyed pseudonym out. `raw.account` must not survive past
      // this line: it is never assigned to a variable that reaches an insert,
      // and this route intentionally has NO request logging — logging the body
      // here would put raw addresses in the log drain, which is exactly the
      // leak account_ref exists to prevent.
      const accountRef = deriveAccountRef(raw.account);

      rows.push({
        session_id: sessionId,
        event,
        props,
        account_ref: accountRef,
        ...dims,
      });

      // Deduped per batch. Twenty events from one visit used to mean twenty
      // account_first_seen upserts; now it means one.
      if (event === "app_opened" && !firstSeenSessions.has(sessionId)) {
        firstSeenSessions.set(sessionId, dims);
      }
      if (accountRef && !firstSeenAccounts.has(accountRef)) {
        firstSeenAccounts.set(accountRef, dims);
      }
    }

    if (rows.length > 0) {
      const supabase = getSupabaseServer();
      if (supabase) {
        // Handed off so the 204 does not wait on the database. Analytics is
        // the definition of non-critical: nothing in purchases, rewards,
        // Peones, PRO, Season Pass, reconciliation, security or idempotency
        // reads this table, and no caller reads this response.
        await afterResponse(async () => {
          // ONE insert for the whole batch.
          await supabase.from("analytics_events").insert(rows);

          // The app_opened root event also fixes the retention cohort.
          // Idempotent: on conflict the first visit's day-0 + first-touch
          // attribution stand.
          for (const [sessionId, dims] of firstSeenSessions) {
            await supabase.from("session_first_seen").upsert(
              {
                session_id: sessionId,
                first_surface: dims.surface,
                first_container: dims.container,
                first_country: dims.country,
                first_source: dims.source,
              },
              { onConflict: "session_id", ignoreDuplicates: true },
            );
          }

          // Account cohort. NOT gated on app_opened: the wallet only becomes
          // known after login, which happens LATER in the visit than
          // app_opened, so gating on it would mean the account cohort is never
          // written at all on the visit that created the account. Same
          // idempotence — first sight wins.
          for (const [accountRef, dims] of firstSeenAccounts) {
            await supabase.from("account_first_seen").upsert(
              {
                account_ref: accountRef,
                first_surface: dims.surface,
                first_container: dims.container,
                first_country: dims.country,
              },
              { onConflict: "account_ref", ignoreDuplicates: true },
            );
          }
        });
      }
    }
  } catch {
    /* swallow — telemetry must never fail user-visible flows */
  }
  return new Response(null, { status: 204 });
}
