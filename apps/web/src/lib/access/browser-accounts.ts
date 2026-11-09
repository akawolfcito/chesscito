import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Cuántas cuentas llegaron por el navegador — el denominador del presupuesto
 * de logins.
 *
 * ⚠️ **Sólo `browser`, y eso es la mitad de la corrección.** MiniPay no pasa por
 * Privy y no gasta MAU: contarlo pondría 5.851 cuentas (medición del
 * 2026-08-14) contra un tope de 460 y cerraría una puerta que nadie estaba
 * empujando. La columna `first_container` ya guarda literalmente
 * `"minipay" | "browser"`, así que esto no necesita migración.
 *
 * ⛔ **`null` es una respuesta, no un error a tragar.** Un conteo que falló y
 * volviera `0` diría "el pozo está vacío" justo en el momento en que no podemos
 * ver cuán lleno está — y `decideLoginCapacity` abriría por el motivo
 * equivocado. El fail-open tiene que ser una decisión declarada, no el efecto
 * secundario de un cero inventado.
 *
 * ⚠️ **Lo que este número NO ve**: la fila la escribe `/api/telemetry`, que es
 * best-effort por diseño (traga sus propios errores para no romper flujos del
 * jugador). Un login cuya telemetría se perdió no se cuenta. Es un
 * SUB-conteo, o sea que el tope cierra más tarde de lo que cree — el sentido
 * incómodo. Hoy es tolerable porque el margen de 39 lugares lo cubre de sobra;
 * si el pozo se acerca al tope, esto se mide antes de confiar en el número.
 */
export async function countBrowserAccounts(): Promise<number | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  try {
    // `count: "exact", head: true` se responde en un header `Content-Range`, con
    // CERO filas transferidas — inmune al techo de 1.000 filas que capea a
    // cualquier lectura por scan.
    const { count, error } = await supabase
      .from("account_first_seen")
      .select("account_ref", { count: "exact", head: true })
      .eq("first_container", "browser");

    if (error) return null;
    return typeof count === "number" && Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}
