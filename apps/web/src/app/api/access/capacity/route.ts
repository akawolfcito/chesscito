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
import {
  decideLoginCapacity,
  resolveCapacityEnabled,
  resolveCapacityLimit,
} from "@/lib/access/login-capacity";
import { getRequestIp } from "@/lib/server/demo-signing";
import { createLogger } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger({ route: "/api/access/capacity" });

export async function GET(req: Request) {
  // ⚠️ `fail-open`: si el limitador se cae, la respuesta correcta es dejar
  // entrar. Un 429 acá tampoco es un bypass real — el allowlist de Privy sigue
  // debajo, y forzar la puerta cuesta exactamente lo mismo que no forzarla.
  const guard = await checkRateLimit({
    identifier: getRequestIp(req),
    route: "access-capacity",
    policy: "fail-open",
  });
  if (!guard.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const config = {
    limit: resolveCapacityLimit(process.env.LOGIN_CAPACITY_LIMIT),
    enabled: resolveCapacityEnabled(process.env.LOGIN_CAPACITY_ENABLED),
  };

  // Con el tope apagado no hay nada que decidir, así que tampoco hay nada que
  // contar: el interruptor de reapertura no debe seguir pegándole a la base.
  const browserAccounts = config.enabled ? await countBrowserAccounts() : null;

  const capacity = decideLoginCapacity({ browserAccounts, config });

  // Se loguea SÓLO el cierre. Es el único evento que hay que ver: sin esta
  // línea, el día que el tope empiece a rebotar gente no lo delata nada, porque
  // el visitante ve una pantalla que ya existía. Loguear también los `open`
  // sería una línea por login intentado para no decir nada.
  if (!capacity.open) {
    log.warn("login_capacity_closed", {
      // El conteo va acá y NUNCA en la respuesta: en el log sirve para saber si
      // cerró por el tope o por configuración rota.
      browser_accounts: browserAccounts,
      limit: config.limit,
    });
  }

  // ⛔ Sale `open` y NADA MÁS. Decirle a un visitante "quedan 3 lugares" es una
  // carrera y una invitación a forzarla.
  return NextResponse.json(
    { open: capacity.open },
    {
      // Sin caché: la perilla tiene que surtir efecto en la consulta siguiente.
      // Es un head-count por login intentado, no por visita — el volumen no
      // justifica cambiar frescura por lecturas.
      headers: { "cache-control": "no-store" },
    },
  );
}
