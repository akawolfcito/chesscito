import { routing } from "@/i18n/routing";

/**
 * Qué hueco renderiza la app mientras ninguna rama de wallet está montada
 * (spec 2026-08-07-wallet-shell-skeleton, C1).
 *
 * ⚠️ Enum y no booleano a propósito: `isHubRoute(): boolean` obliga a cada
 * call-site a recordar qué significa `true`, y agregar un tercer hueco
 * (`"exercise"`, digamos) cambiaría la firma de todos. Acá nombra los huecos y
 * crecer no rompe a nadie.
 */
export type WalletShellVariant = "hub" | "plain";

/**
 * Las raíces que SON el hub, derivadas de `routing.locales`.
 *
 * ⛔ Nunca una lista escrita a mano: con `localePrefix: "as-needed"` el locale
 * por defecto sirve en `/` y los demás llevan prefijo, así que un locale nuevo
 * agrega una raíz nueva. Derivarla es lo que evita que este módulo quede viejo
 * en silencio el día que entre un idioma.
 *
 * `/en` está incluido por el mismo `routing.locales`: next-intl lo canonicaliza
 * a `/` con un 307, pero el pathname del cliente puede leerlo antes del salto.
 */
const HUB_PATHS: ReadonlySet<string> = new Set([
  "/",
  ...routing.locales.map((locale) => `/${locale}`),
]);

/**
 * Normaliza la barra final. El router no la entrega —Next redirige 308 con
 * `trailingSlash: false`— pero el parámetro acepta cualquier string, así que un
 * caller puede producirla y la misma página no puede dar dos respuestas.
 */
function withoutTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/**
 * Decide qué shell recibe una ruta.
 *
 * ⛔ Comparación EXACTA contra un `Set`, jamás `startsWith`. `/enough` y
 * `/esfoo` empiezan con el prefijo de un locale y no son el hub; un
 * `startsWith("/en")` los pintaría con la silueta y nadie lo notaría hasta ver
 * una pantalla que promete un hub que no llega.
 *
 * `null`/`undefined`/`""` → `plain`: si no sabemos dónde estamos, el error
 * seguro es el hueco vacío, no una promesa falsa.
 */
export function resolveWalletShellVariant(
  pathname: string | null | undefined,
): WalletShellVariant {
  if (!pathname) return "plain";
  return HUB_PATHS.has(withoutTrailingSlash(pathname)) ? "hub" : "plain";
}
