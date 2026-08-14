/**
 * El tope duro de logins web.
 *
 * ⚠️ Existe por una razón de plata, no de seguridad. El plan Core de Privy es
 * gratis de 0 a **499 MAU** y pasa a **$299/mes** desde 500. Un pico orgánico
 * cruza ese número sin que nadie apriete nada, y la factura llega igual —
 * exactamente el tipo de costo inesperado que el founder ya pagó una vez con la
 * infra (2026-08-13).
 *
 * ⛔ **Esto es un PRESUPUESTO, no un candado.** Vive en nuestro cliente, así que
 * es evitable en principio. Quien CONCEDE el acceso sigue siendo el allowlist
 * nativo de Privy, que es server-side y sin bypass. Si alguien lo lee como
 * control de acceso y apaga el allowlist "porque ya tenemos el tope", el acceso
 * queda abierto de par en par.
 *
 * ⚠️ **Contra qué SÍ es duro:** contra un pico orgánico, que es el riesgo real.
 * Los usuarios reales pasan por nuestra UI, y si no llamamos a `login()` no se
 * gasta MAU.
 */

/**
 * Qué contamos, y por qué NO es el MAU.
 *
 * Privy factura por MAU — *"a user who has had their session refreshed in the
 * past thirty days"* — que es una ventana móvil. Nosotros contamos algo distinto
 * y más simple: **cuántas cuentas de `container='browser'` existen en total**
 * (`account_first_seen`, que ya existe y no necesita migración).
 *
 * ✅ **Y eso es correcto, porque es una sobre-aproximación en la dirección
 * segura**: el MAU nunca puede superar la cantidad de cuentas que existen, así
 * que topear el total **garantiza** el MAU. Cierra antes de lo necesario, jamás
 * después.
 *
 * ⛔ El corolario incómodo: el número **sólo sube**. Una cuenta que no vuelve
 * nunca deja de contar acá aunque haya salido del MAU de Privy. Con el tiempo el
 * tope se vuelve más conservador de lo que hace falta, y ese es el precio de no
 * llevar una ventana móvil propia. Si algún día estorba, la respuesta es contar
 * sesiones en 30 días, no subir el tope a ciegas.
 *
 * ⚠️ MiniPay NO entra en esta cuenta: no pasa por Privy y no gasta MAU.
 */
export type LoginCapacityConfig = {
  /** Tope efectivo. ⚠️ Debe ir POR DEBAJO de 499 — ver DEFAULT_CAPACITY_LIMIT. */
  limit: number;
  /** Apagar el tope sin borrarlo. El interruptor para reabrir. */
  enabled: boolean;
};

export type LoginCapacityInput = {
  /** Cuentas de browser existentes. `null` = no se pudo contar. */
  browserAccounts: number | null;
  config: LoginCapacityConfig;
};

/** Lo único que el cliente necesita saber. ⛔ Nunca se le manda `used` ni
 *  `limit`: decirle a un visitante "quedan 3 lugares" es una carrera y una
 *  invitación a forzarla. */
export type LoginCapacity = { open: boolean };

/**
 * El default deja **39 lugares de margen** bajo los 499 del plan gratis.
 *
 * ⛔ El margen no es un redondeo: es el diseño. El chequeo **no puede ser
 * transaccional con el contador de Privy**, así que N visitantes que tocan ENTER
 * a la vez cerca del umbral leen todos `open: true` y entran todos. Sin margen,
 * ese pelotón es exactamente el que cruza a los 500 y dispara la factura que
 * este módulo existe para evitar.
 */
export const DEFAULT_CAPACITY_LIMIT = 460;

function isUsableCount(n: number | null): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function isUsableLimit(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/**
 * ¿Se admite un login más?
 *
 * ⚠️ Las dos ramas de "ante la duda" van para lados OPUESTOS, y no es una
 * contradicción:
 *
 * - **Config rota → CIERRA.** Es un error nuestro, lo vemos y lo arreglamos
 *   antes de perder a nadie; y el costo de equivocarse hacia el lado abierto es
 *   la factura recurrente.
 * - **Conteo imposible → ABRE.** Una DB caída no puede dejar a todo el mundo
 *   afuera de la app, y el allowlist de Privy sigue debajo como red real.
 */
export function decideLoginCapacity({
  browserAccounts,
  config,
}: LoginCapacityInput): LoginCapacity {
  if (!config.enabled) return { open: true };
  if (!isUsableLimit(config.limit)) return { open: false };
  if (!isUsableCount(browserAccounts)) return { open: true };
  return { open: browserAccounts < config.limit };
}

/** Lee el tope de su origen de configuración, con un default seguro. */
export function resolveCapacityLimit(raw: string | undefined): number {
  if (!raw) return DEFAULT_CAPACITY_LIMIT;
  const parsed = Number(raw);
  return isUsableLimit(parsed) ? parsed : DEFAULT_CAPACITY_LIMIT;
}

/**
 * El interruptor, con el default hacia el lado que cuida la plata.
 *
 * ⛔ **Prendido sin configuración.** Un tope que hay que acordarse de prender no
 * es un tope: el riesgo que esto existe para atajar es un pico orgánico, que por
 * definición ocurre cuando nadie está mirando. El límite ya tiene un default
 * seguro, así que prender por defecto no cierra ninguna puerta que estuviera
 * abierta — sólo le pone techo.
 *
 * ⚠️ Y sólo se apaga con una palabra explícita: un typo en la perilla debe
 * dejarlo prendido, nunca abrirlo de par en par en silencio.
 */
export function resolveCapacityEnabled(raw: string | undefined): boolean {
  if (!raw) return true;
  const normalized = raw.trim().toLowerCase();
  return normalized !== "false" && normalized !== "0";
}
