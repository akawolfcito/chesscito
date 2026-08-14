import { getSupabaseServer } from "@/lib/supabase/server";

import {
  resolveCapacityEnabled,
  resolveCapacityLimit,
  type LoginCapacityConfig,
} from "./login-capacity";

/**
 * La perilla del presupuesto de logins, leída de su fila.
 *
 * ⛔ **Vive en una fila y no en un env var por una razón medida**: en Vercel
 * toda env var exige redeploy, y un redeploy de este repo tarda 8–10 minutos
 * (medición del founder durante el pico de MiniPay de los primeros días).
 * Durante un pico eso no es una perilla — para cuando el deploy termina, la
 * gente ya entró. Con la fila, mover el número o apagar el acceso son segundos.
 *
 * ⚠️ **La fila le GANA al env var.** Si no ganara, la perilla en vivo no serviría
 * de nada en cualquier entorno donde el env var esté seteado, que es justo
 * producción.
 *
 * ⛔ **Y esto nunca devuelve "no sé".** Fila ilegible → env var → default seguro.
 * Un lector de config que puede contestar `null` obliga a cada llamador a
 * inventar qué hacer con eso, y ahí es donde nacen los fail-closed accidentales
 * — que en este sistema significan "nadie entra a la app".
 */
export async function readCapacityConfig(): Promise<LoginCapacityConfig> {
  const fromEnv: LoginCapacityConfig = {
    limit: resolveCapacityLimit(process.env.LOGIN_CAPACITY_LIMIT),
    enabled: resolveCapacityEnabled(process.env.LOGIN_CAPACITY_ENABLED),
  };

  const supabase = getSupabaseServer();
  if (!supabase) return fromEnv;

  try {
    const { data, error } = await supabase
      .from("login_capacity_config")
      .select("seat_limit, enabled")
      // El singleton. La tabla no admite otra fila (`boolean primary key check
      // (id)`), pero pedirla por id deja el lector correcto aunque alguien
      // afloje esa restricción más adelante.
      .eq("id", true)
      .maybeSingle();

    if (error || !data) return fromEnv;

    return {
      // Un `seat_limit` inservible se repara al default sin arrastrar consigo al
      // `enabled`: son dos perillas, y un número roto no es motivo para ignorar
      // la decisión de haber apagado el tope.
      limit: resolveCapacityLimit(
        typeof data.seat_limit === "number" ? String(data.seat_limit) : undefined,
      ),
      enabled: data.enabled !== false,
    };
  } catch {
    return fromEnv;
  }
}
