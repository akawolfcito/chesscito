import { createHash, timingSafeEqual } from "node:crypto";

/**
 * El gate de `ADMIN_TOKEN`, compartido.
 *
 * Ya vivía copiado en `/api/admin/content` y `/api/admin/lite-stats`. Esta es la
 * extracción, no una tercera copia: un chequeo de auth duplicado es el lugar
 * exacto donde una corrección se aplica en dos de tres sitios y el tercero queda
 * abierto sin que nada se ponga rojo.
 *
 * ⚠️ Las dos rutas viejas siguen con su copia local a propósito — migrarlas es
 * un cambio de comportamiento sobre superficie que hoy anda, y no entra en el
 * trabajo que lo motivó. Que migren cuando se las toque por otra razón.
 *
 * ⛔ `sha256` antes de `timingSafeEqual` no es paranoia decorativa: la función
 * exige buffers del MISMO largo o tira, así que comparar los tokens crudos
 * filtraría el largo del secreto por la vía del error. El digest los iguala en
 * 32 bytes siempre.
 */
export type AdminAuthResult =
  /** Hay token configurado y el que llegó coincide. */
  | { ok: true }
  /** No hay `ADMIN_TOKEN` en el entorno: la superficie está apagada, no rota. */
  | { ok: false; status: 503; error: "admin_disabled" }
  /** Llegó ausente o equivocado. */
  | { ok: false; status: 403; error: "forbidden" };

export function authorizeAdmin(request: Request): AdminAuthResult {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return { ok: false, status: 503, error: "admin_disabled" };

  const provided = request.headers.get("x-admin-token");
  if (!provided) return { ok: false, status: 403, error: "forbidden" };

  const sha = (s: string) => createHash("sha256").update(s).digest();
  if (!timingSafeEqual(sha(provided), sha(expected))) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  return { ok: true };
}
