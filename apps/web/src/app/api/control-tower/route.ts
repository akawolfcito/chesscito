/**
 * GET / POST /api/control-tower — el interruptor del waitlist.
 *
 * Existe para una necesidad concreta del founder: poder abrir o cerrar el acceso
 * web **desde cualquier lado, sin autenticarse en Vercel ni en Supabase, sin
 * acordarse de qué tabla ni de qué query, y sin depender de una máquina con
 * Docker**. Durante un pico, el camino "entrar al dashboard y escribir SQL" no
 * es un camino.
 *
 * ⛔ **EL RADIO DE DAÑO ESTÁ ACOTADO, Y ES LO QUE PERMITE QUE ESTO EXISTA ASÍ.**
 * Con el token, lo peor que se logra es apagar el tope (pagamos Privy) o ponerlo
 * en 1 (nadie nuevo entra). No se expone ni un dato, y las dos cosas se
 * revierten en un tap. Un panel de operaciones general —con el service role
 * detrás de acciones arbitrarias— NO tiene ese techo y no puede construirse con
 * esta ceremonia.
 *
 * ⚠️ Y sigue sin ser un candado: quien CONCEDE el acceso web es el allowlist
 * nativo de Privy. Esto mueve un presupuesto, no una puerta.
 *
 * Contrato:
 *   GET  → { enabled, limit, browserAccounts, headroom, open }
 *   POST { enabled?, limit? } → el estado YA aplicado, + overPlanCeiling
 *   400 invalid_request · 403 forbidden · 429 rate_limited
 *   503 admin_disabled (sin ADMIN_TOKEN) / unavailable (sin base)
 */

import { NextResponse } from "next/server";

import { countBrowserAccounts } from "@/lib/access/browser-accounts";
import { authorizeAdmin } from "@/lib/server/admin-token";
import { getRequestIp } from "@/lib/server/demo-signing";
import { createLogger } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger({ route: "/api/control-tower" });

/** El techo del plan gratis de Privy, HOY. Sólo para avisar, nunca para
 *  bloquear: es un hecho de su pricing y puede cambiar. */
const PRIVY_FREE_PLAN_CEILING = 499;

/** Cota de sanidad, no una regla de producto. Un `limit` de siete cifras es un
 *  dedazo, no una decisión. */
const MAX_ACCEPTABLE_LIMIT = 100_000;

function err(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * ⚠️ Fail-open a propósito, igual que la ruta pública pero por otra razón: esto
 * es el botón de emergencia, y un Redis caído no puede dejar al founder sin su
 * interruptor — sería fallar justo en el escenario para el que existe. Quien
 * protege acá es el token, que es de alta entropía; el limitador sólo baja el
 * ruido de un intento de fuerza bruta.
 */
async function guard(req: Request) {
  const decision = await checkRateLimit({
    identifier: getRequestIp(req),
    route: "admin-access-capacity",
    policy: "fail-open",
  });
  return decision.allowed;
}

type ConfigRow = { seat_limit: number; enabled: boolean };

async function readRow(): Promise<ConfigRow | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("login_capacity_config")
    .select("seat_limit, enabled")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as ConfigRow;
}

/** El estado que el botón dibuja. ⛔ Acá el conteo SÍ viaja — es toda la
 *  diferencia con `/api/access/capacity`, que la lee un visitante. Sin el
 *  número, el botón no avisa nada hasta que ya cerró. */
async function snapshot(row: ConfigRow) {
  const browserAccounts = await countBrowserAccounts();
  return {
    enabled: row.enabled,
    limit: row.seat_limit,
    browserAccounts,
    // `null`, nunca un cero inventado: un headroom fabricado sobre un conteo que
    // falló es exactamente el número que se lee como tranquilidad.
    headroom: browserAccounts === null ? null : row.seat_limit - browserAccounts,
    open: !row.enabled || browserAccounts === null || browserAccounts < row.seat_limit,
  };
}

export async function GET(req: Request) {
  const auth = authorizeAdmin(req);
  if (!auth.ok) return err(auth.error, auth.status);
  if (!(await guard(req))) return err("rate_limited", 429);

  const row = await readRow();
  if (!row) return err("unavailable", 503);

  return NextResponse.json(await snapshot(row), {
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(req: Request) {
  const auth = authorizeAdmin(req);
  if (!auth.ok) return err(auth.error, auth.status);
  if (!(await guard(req))) return err("rate_limited", 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("invalid_request", 400);
  }
  if (typeof body !== "object" || body === null) return err("invalid_request", 400);

  const { enabled, limit } = body as { enabled?: unknown; limit?: unknown };

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: "admin-panel",
  };

  if (limit !== undefined) {
    if (
      typeof limit !== "number" ||
      !Number.isInteger(limit) ||
      limit <= 0 ||
      limit > MAX_ACCEPTABLE_LIMIT
    ) {
      return err("invalid_request", 400);
    }
    patch.seat_limit = limit;
  }

  if (enabled !== undefined) {
    if (typeof enabled !== "boolean") return err("invalid_request", 400);
    patch.enabled = enabled;
  }

  // Un POST que no pide ningún cambio sólo sellaría `updated_at` y devolvería un
  // "listo" sobre una edición que nunca existió.
  if (patch.seat_limit === undefined && patch.enabled === undefined) {
    return err("invalid_request", 400);
  }

  const supabase = getSupabaseServer();
  if (!supabase) return err("unavailable", 503);

  const { data, error } = await supabase
    .from("login_capacity_config")
    .update(patch)
    .eq("id", true)
    .select("seat_limit, enabled")
    .maybeSingle();

  if (error || !data) {
    log.error("login_capacity_write_failed", { has_row: Boolean(data) });
    return err("unavailable", 503);
  }

  const row = data as ConfigRow;

  // Se loguea TODO movimiento de la perilla, no sólo los cierres: es la única
  // acción de este sistema que puede costar plata de verdad, y su registro es lo
  // que permite reconstruir "¿desde cuándo estaba abierto?".
  log.warn("login_capacity_knob_moved", {
    seat_limit: row.seat_limit,
    enabled: row.enabled,
  });

  return NextResponse.json(
    {
      ...(await snapshot(row)),
      // Se acepta y se avisa. Bloquearlo haría que el botón mienta el día que
      // Privy cambie su pricing.
      overPlanCeiling: row.seat_limit >= PRIVY_FREE_PLAN_CEILING,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
