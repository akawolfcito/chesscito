/**
 * GET /api/access/capacity
 *
 * ¿Se admite un login web más? Spec: `docs/specs/2026-08-13-login-capacity-cap-spec.md`.
 *
 * ⛔ **ESTO ES UN PRESUPUESTO, NO UN CANDADO.** Quien CONCEDE el acceso web
 * sigue siendo el allowlist nativo de Privy, que es server-side y sin bypass.
 * Esta ruta le dice a nuestro propio cliente cuándo dejar de llamar a `login()`,
 * y su razón de ser es financiera: el plan Core de Privy es gratis hasta 499 MAU
 * y salta a $299/mes desde 500. Si alguien lee esto como control de acceso y
 * apaga el allowlist *"porque ya tenemos el tope"*, el acceso queda abierto de
 * par en par.
 *
 * ⚠️ **Sin autenticación a propósito**: corre ANTES del login. Pedir sesión para
 * consultarlo gastaría el MAU que la consulta existe para cuidar — el mismo
 * razonamiento que deja abierta a `/api/early-access/request`.
 *
 * Contrato:
 *   200 → { open: boolean }
 *   429 → { error: "rate_limited" }   ⚠️ el cliente lo trata como ABIERTO
 */

import { NextResponse } from "next/server";

import { countBrowserAccounts } from "@/lib/access/browser-accounts";
import { readCapacityConfig } from "@/lib/access/capacity-config";
import { decideLoginCapacity } from "@/lib/access/login-capacity";
import {
  readCachedVerdict,
  VERDICT_TTL_MS,
  writeCachedVerdict,
} from "@/lib/access/verdict-cache";
import { getRequestIp } from "@/lib/server/demo-signing";
import { createLogger } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger({ route: "/api/access/capacity" });

function respond(open: boolean) {
  return NextResponse.json(
    // ⛔ Sale `open` y NADA MÁS. Decirle a un visitante "quedan 3 lugares" es una
    // carrera y una invitación a forzarla.
    { open },
    {
      headers: {
        // Público porque la respuesta es la misma para todo el mundo: no hay
        // nada por visitante acá. Que el CDN absorba el pico es lo que evita que
        // un momento viral se convierta en una tormenta de invocaciones.
        "cache-control": `public, s-maxage=${VERDICT_TTL_MS / 1000}, stale-while-revalidate=30`,
      },
    },
  );
}

export async function GET(req: Request) {
  // ⛔ EL CACHÉ VA ANTES DEL LIMITADOR, Y ESE ORDEN IMPORTA. Un veredicto fresco
  // no hace trabajo de base, así que no hay nada que proteger: cobrarle cuota a
  // una respuesta gratis es lo que convertía al limitador en el interruptor de
  // apagado del tope durante un pico.
  const now = Date.now();
  const cached = readCachedVerdict(now);
  if (cached !== null) return respond(cached);

  // ⚠️ `fail-open`: si el limitador se cae, la respuesta correcta es dejar
  // entrar. El allowlist de Privy sigue debajo como red real.
  const guard = await checkRateLimit({
    identifier: getRequestIp(req),
    route: "access-capacity",
    policy: "fail-open",
  });
  if (!guard.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const config = await readCapacityConfig();

  // Con el tope apagado no hay nada que decidir, así que tampoco hay nada que
  // contar: el interruptor de reapertura no debe seguir pegándole a la base.
  const browserAccounts = config.enabled ? await countBrowserAccounts() : null;

  const capacity = decideLoginCapacity({ browserAccounts, config });

  // Se loguea SÓLO el cierre. Es el único evento que hay que ver: el visitante
  // rebotado aterriza en una pantalla que ya existía, así que sin esta línea el
  // día que el tope empiece a rebotar gente no lo delata nada. Loguear también
  // los `open` sería una línea por login intentado para no decir nada.
  if (!capacity.open) {
    log.warn("login_capacity_closed", {
      // El conteo va acá y NUNCA en la respuesta: en el log sirve para saber si
      // cerró por el tope o por configuración rota.
      browser_accounts: browserAccounts,
      limit: config.limit,
    });
  }

  writeCachedVerdict(capacity.open, now);
  return respond(capacity.open);
}
