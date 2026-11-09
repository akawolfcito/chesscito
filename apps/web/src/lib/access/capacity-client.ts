/** El lado cliente del presupuesto de logins: una pregunta, y una sola forma
 *  de contestar que NO. */

const CAPACITY_ENDPOINT = "/api/access/capacity";

/**
 * ¿Hay lugar para un login más?
 *
 * ⛔ **Sólo un `open: false` explícito cierra.** Todo lo demás —red caída, 429,
 * 500, un body que no es el que esperábamos, algo que ni siquiera es JSON— es
 * una pregunta sin responder, y una pregunta sin responder no puede dejar a
 * nadie afuera del producto. Ese fail-open no es descuido: el costo de
 * equivocarse hacia el lado abierto es un login de más contra un margen de 39
 * lugares; el de equivocarse hacia el lado cerrado es que nadie entra. Y el
 * candado real —el allowlist de Privy— sigue debajo en los dos casos.
 */
export async function hasLoginCapacity(): Promise<boolean> {
  try {
    const res = await fetch(CAPACITY_ENDPOINT, { cache: "no-store" });
    if (!res.ok) return true;

    const body: unknown = await res.json();
    if (typeof body !== "object" || body === null) return true;
    return (body as { open?: unknown }).open !== false;
  } catch {
    return true;
  }
}
