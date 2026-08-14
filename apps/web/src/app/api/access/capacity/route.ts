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
import { getRequestIp } from "@/lib/server/demo-signing";
import { createLogger } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger({ route: "/api/access/capacity" });

/**
 * Cuánto vive un veredicto ya calculado, en memoria de la instancia.
 *
 * ⛔ **Esto NO es una optimización, es la corrección del agujero del pico.** El
 * limitador corta a 60 req/min por IP, y detrás de CGNAT —el caso normal en
 * móvil— mucha gente comparte una sola IP de salida. Sin caché, el visitante 61
 * de un minuto recibía 429, y el cliente falla abierto: el tope se apagaba solo
 * **exactamente en el escenario para el que existe**.
 *
 * Con el caché delante, una instancia toca la base como mucho una vez cada 10 s,
 * así que el limitador casi nunca ve tráfico y el 429 deja de ser el camino
 * frecuente.
 *
 * ⚠️ **El precio es el tiempo de reacción de la perilla**: hasta 10 s acá más
 * hasta 10 s del CDN, o sea ~20 s en el peor caso desde que se edita la fila.
 * Contra los 8–10 minutos de un redeploy, es el intercambio que se quiso hacer.
 */
const VERDICT_TTL_MS = 10_000;

let cachedVerdict: { open: boolean; expiresAt: number } | null = null;

/** Test hook — tira el veredicto cacheado. */
export function __resetCapacityCache(): void {
  cachedVerdict = null;
}

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
  if (cachedVerdict && now < cachedVerdict.expiresAt) {
    return respond(cachedVerdict.open);
  }

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

  cachedVerdict = { open: capacity.open, expiresAt: now + VERDICT_TTL_MS };
  return respond(capacity.open);
}
