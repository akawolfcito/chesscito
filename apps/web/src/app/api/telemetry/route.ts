import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_EVENT_LEN = 64;
const MAX_SESSION_LEN = 64;
const MAX_PROPS_BYTES = 4_096;

type Payload = {
  session_id?: unknown;
  event?: unknown;
  props?: unknown;
};

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

    const supabase = getSupabaseServer();
    if (!supabase) return new Response(null, { status: 204 });

    // Intentionally not awaited-logged. Errors are swallowed — this
    // endpoint never reports failure to the client.
    await supabase.from("analytics_events").insert({
      session_id: sessionId,
      event,
      props,
    });
  } catch {
    /* swallow — telemetry must never fail user-visible flows */
  }
  return new Response(null, { status: 204 });
}
