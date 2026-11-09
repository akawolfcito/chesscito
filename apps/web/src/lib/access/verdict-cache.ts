/**
 * El veredicto de capacidad, cacheado en memoria de la instancia.
 *
 * ⛔ **Vive acá y no en el route handler por una razón de plataforma, no de
 * estilo**: Next valida los exports de un `route.ts` contra una lista cerrada
 * (`GET`, `POST`, `runtime`, `dynamic`, …) y **rompe el build** ante cualquier
 * otro nombre. El hook de reset que los tests necesitan no cabe ahí:
 *
 *     Type error: "__resetCapacityCache" is not a valid Route export field.
 *
 * ⚠️ Y eso NO lo ve `tsc --noEmit`: es una validación de `next build`. Un módulo
 * aparte lo vuelve imposible por construcción.
 *
 * ⛔ **El caché no es una optimización, es la corrección del agujero del pico.**
 * El limitador corta a 60 req/min por IP, y detrás de CGNAT —el caso normal en
 * móvil— mucha gente comparte una sola IP de salida. Sin caché, el visitante 61
 * de un minuto recibía 429, y el cliente falla abierto: el tope **se apagaba
 * solo exactamente en el escenario para el que existe**.
 *
 * ⚠️ El precio es el tiempo de reacción de la perilla: hasta 10 s acá más hasta
 * 10 s del CDN, ~20 s en el peor caso. Contra los 8–10 minutos de un redeploy,
 * es el intercambio que se quiso hacer.
 */
export const VERDICT_TTL_MS = 10_000;

let cachedVerdict: { open: boolean; expiresAt: number } | null = null;

/** El veredicto fresco, o `null` si no hay o venció. */
export function readCachedVerdict(now: number): boolean | null {
  if (cachedVerdict && now < cachedVerdict.expiresAt) return cachedVerdict.open;
  return null;
}

export function writeCachedVerdict(open: boolean, now: number): void {
  cachedVerdict = { open, expiresAt: now + VERDICT_TTL_MS };
}

/** Test hook — tira el veredicto cacheado. */
export function __resetCapacityCache(): void {
  cachedVerdict = null;
}
