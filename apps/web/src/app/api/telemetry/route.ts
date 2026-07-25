import { getSupabaseServer } from "@/lib/supabase/server";
import { deriveAccountRef } from "@/lib/analytics/account-ref";
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

const MAX_EVENT_LEN = 64;
const MAX_SESSION_LEN = 64;
const MAX_PROPS_BYTES = 4_096;
const MAX_VISIT_LEN = 64;

type Payload = {
  session_id?: unknown;
  event?: unknown;
  props?: unknown;
  dims?: unknown;
  /** Raw connected address. Consumed here and replaced by a keyed pseudonym —
   *  never persisted, never logged, never echoed back. */
  account?: unknown;
};

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
    surface: normalizeSurface(d.surface),
    container: normalizeContainer(d.container),
    locale: normalizeLocale(d.locale),
    country, // from edge header only
    source: normalizeSource(d.source),
    campaign: normalizeCampaign(d.campaign),
    app_version: normalizeAppVersion(d.app_version),
    visit_id: visit,
  };
}

function sanitizeProps(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  try {
    const serialized = JSON.stringify(raw);
    if (serialized.length > MAX_PROPS_BYTES) return null;
  } catch {
    return null;
  }
  // Strip any nested objects beyond 2 levels + coerce primitives.
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key.length > 40) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value == null
    ) {
      out[key] = value;
    }
  }
  return out;
}

export async function POST(req: Request) {
  // Fire-and-forget from the client — always 204 so UI never blocks on
  // analytics. Sanitize + validate, drop silently on any failure.
  try {
    const payload = (await req.json()) as Payload;
    const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
    const event = typeof payload.event === "string" ? payload.event : "";
    if (!sessionId || !event) return new Response(null, { status: 204 });
    if (sessionId.length > MAX_SESSION_LEN || event.length > MAX_EVENT_LEN) {
      return new Response(null, { status: 204 });
    }

    const props = sanitizeProps(payload.props);

    // Country comes ONLY from the edge geo header — never from the client
    // payload. We keep ISO alpha-2 and nothing else: no IP, city, region,
    // postal code, or coordinates is ever read or stored (privacy §7).
    const country = normalizeCountry(
      req.headers.get("x-vercel-ip-country"),
    );
    const dims = sanitizeDims(payload.dims, country);

    // Wallet in, keyed pseudonym out. `payload.account` must not survive past
    // this line: it is never assigned to a variable that reaches an insert,
    // and this route intentionally has NO request logging — logging the body
    // here would put raw addresses in the log drain, which is exactly the
    // leak account_ref exists to prevent.
    const accountRef = deriveAccountRef(payload.account);

    const supabase = getSupabaseServer();
    if (!supabase) return new Response(null, { status: 204 });

    // Intentionally not awaited-logged. Errors are swallowed — this
    // endpoint never reports failure to the client.
    await supabase.from("analytics_events").insert({
      session_id: sessionId,
      event,
      props,
      account_ref: accountRef,
      ...dims,
    });

    // The app_opened root event also fixes the retention cohort. Idempotent:
    // on conflict the first visit's day-0 + first-touch attribution stand.
    if (event === "app_opened") {
      await supabase
        .from("session_first_seen")
        .upsert(
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

    // Account cohort. NOT gated on app_opened: the wallet only becomes known
    // after login, which happens LATER in the visit than app_opened, so
    // gating on it would mean the account cohort is never written at all on
    // the visit that created the account. Same idempotence — first sight wins.
    if (accountRef) {
      await supabase
        .from("account_first_seen")
        .upsert(
          {
            account_ref: accountRef,
            first_surface: dims.surface,
            first_container: dims.container,
            first_country: dims.country,
          },
          { onConflict: "account_ref", ignoreDuplicates: true },
        );
    }
  } catch {
    /* swallow — telemetry must never fail user-visible flows */
  }
  return new Response(null, { status: 204 });
}
