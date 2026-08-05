# Cierre de sesión — consolidación de `/stats` + handoff de la IA

**Fecha:** 2026-08-05
**Rama actual:** `feat/stats-information-architecture` (local, vacía, sobre `7ecc64da`)
**`origin/main`:** `b8e58996` · **`main` local:** `7ecc64da` — **2 commits sin pushear**

> **La consolidación de `/stats` está TERMINADA y validada en producción.**
> La siguiente iniciativa está especificada y **no empezada**: cero código escrito.

---

## 1. Qué quedó vivo en producción

**SHA desplegado: `b8e58996`** · `chesscito-landing-qsj754b0p` · READY 38 s.

`https://www.chesscito.com/stats` publica el dashboard consolidado: una URL
canónica, ocho RPC server-side, `noindex, nofollow`, fuera del sitemap, pública
sin wallet ni auth, EN/ES por `Accept-Language` con override `?locale=`, filtros
`surface` × `container`, y caché de snapshot de 900 s bajo el tag
`public-stats` con invalidación por token.

### El recorrido, en una tabla

| Fase | Qué | Estado |
|---|---|---|
| A | ocho RPC `stats_*` | ✅ producción · verificador **1.084/1.084** |
| B | cliente Supabase server-only en el landing | ✅ `e024658f` |
| C | agregador alimentado por las RPC | ✅ `ebbd3035` |
| D | dashboard consolidado | ✅ `f4c71e02` |
| E | una capa de caché deliberada | ✅ `b2c0873d` |
| — | **incidente de identidad de caché** | ✅ cerrado en `b8e58996` |
| F | validación contra SQL | ✅ `01f6a10f` — **local, sin pushear** |
| G | redirects | ⛔ **CANCELADA** — sin consumidores |
| H | retirada del código viejo | pendiente, sin urgencia |

### Lo que el trabajo corrigió

La página publicaba `App opened 37 < Hub viewed 41`, `Inactive 962` contra un
**0** real, y Kenia octava con 1 sesión cuando es tercera con 320. Causa:
`count(distinct …)` en JS sobre filas que PostgREST ya había capado en 1.000,
ordenadas newest-first — «últimos 30 días» era en realidad «últimos 15 minutos».

Hoy los cinco filtros coinciden con las RPC con **Δ máximo 2**, y `all/browser`
—la combinación de menor tráfico, donde la deriva no alcanza a moverse—
coincide **exacto en los seis campos**.

---

## 2. Dos cosas que aprendí por las malas

### 🔬 `next start` NO puede falsar una hipótesis de caché

El wrapper de `unstable_cache` se construía **por request**. En Vercel eso
mintea una entrada nueva en cada invocación, así que `/stats` regeneraba en cada
visita: 1,9–3,6 s por vista y una conexión que colgó **38,8 s**.

**Localmente era invisible.** `next start` es un proceso de larga vida, así que
un closure nuevo cae igual en el mismo store en memoria — y mi contrafactual
local **midió un hit limpio sobre el código roto y lo declaró inocente**. Lo
escribí yo. `force-dynamic`, mi principal sospechoso, era inocente.

Guard: `cache-identity-guard.test.ts`, de **fuente**, porque ningún test de
comportamiento puede ver esto. Escribí **dos reglas equivocadas** antes de dar
con la correcta — prohibir el call-site no lo detectaba (el defecto *pasaba* la
función en vez de llamarla) y prohibir la mención rompía el fix.

### 🔬 Un guard que dispara sobre el test que afirma la misma regla

Pasó **tres veces**: el guard de secretos contra su propia prosa, el de caché
contra `not.toContain("content")`, y el de `unstable_cache` contra
`cache-identity-guard.test.ts`. La solución siempre fue la misma: separar
**código** de **prosa**, y excluir `__tests__` de las reglas sobre producción.

---

## 3. Estado de git — leer antes de tocar nada

```
origin/main                      b8e58996
main (local)                     7ecc64da   ⬅ 2 commits POR DELANTE
  01f6a10f  docs(stats): validate consolidated dashboard against production
  7ecc64da  docs(stats): define dashboard information architecture
rama actual                      feat/stats-information-architecture (sobre 7ecc64da, vacía)
sin stagear                      SESSION.md  ⬅ debe quedar fuera, siempre
```

⚠️ **Los dos commits documentales NO se pushean solos.** Viajan con el próximo
deployment que lleve cambios de producto — o sea, con esta iniciativa.

⚠️ **Pushear a `main` DESPLIEGA producción** en este repo (auto-deploy de git).
El script de skip cancela `chesscito` y `lite-chesscito` cuando sólo cambia el
landing, así que un push del landing = **un solo build**.

---

## 4. Variables remotas — `chesscito-landing`

| Variable | Scopes | Nota |
|---|---|---|
| `SUPABASE_URL` | Preview + Production | Encrypted |
| `SUPABASE_SERVICE_ROLE_KEY` | Preview + Production | Encrypted |
| `STATS_REVALIDATE_TOKEN` | Preview + Production | Encrypted · ⚠️ **Sensitive: `vercel env pull` lo REDACTA** (11 bytes en vez de 96). No se puede recuperar; para usarlo hay que rotarlo **y redesplegar** |
| ~~`STATS_DEBUG`~~ | — | **eliminada** al cerrar el incidente |

⚠️ Auditar siempre con `vercel env ls` **sin filtro de environment**: el filtro
esconde las filas del otro scope.

---

## 5. La siguiente iniciativa — *Stats dashboard information architecture*

**Spec aprobada. Rama creada. Cero código escrito.**

**Objetivo:** que `/stats` se lea mejor **sin cambiar ninguna fuente, RPC,
agregador, caché ni contrato de datos.** Si una idea necesita un dato nuevo,
**se descarta la idea**.

### Alcance — sólo esto

```
apps/landing/src/app/stats/page.tsx
apps/landing/src/components/stats/*
apps/landing/src/lib/stats/copy.ts
+ tests de presentación
```

⛔ **Intocables:** RPC, SQL, migraciones, `aggregator.ts`, `snapshot.ts`, caché,
cliente Supabase, fuentes on-chain, fuente del censo, rutas, middleware,
`apps/web`.

### Jerarquía nueva, en orden

1. Header → 2. Contexto editorial de lanzamiento → 3. **At a glance** →
4. **From reach to habit** → 5. Engagement → 6. Audience → 7. Activity →
8. On-chain → 9. Methodology

### Contexto editorial

```ts
MINIPAY_LAUNCH_DATE = "2026-08-03"   // constante tipada
```
- EN: `Since MiniPay launch · August 3, 2026`
- ES: `Desde el lanzamiento en MiniPay · 3 de agosto de 2026`

⛔ **No derivar de telemetría** (caería en el alcance prohibido) y **no meterla
en ninguna clave de caché**.

### At a glance — exactamente cinco

Sessions (7d) · Active people (7d) · Exercises started · Exercises completed ·
**Early habit signal**.

⚠️ El quinto usa el mejor dato existente **sin presentarlo como retención
madura**, con copy que diga que las ventanas de 7/14/21 días **todavía están
madurando desde el lanzamiento**. ⛔ **Sin ratios nuevos.**

### Recorrido narrativo

**From first visit to habit / Del primer ingreso al hábito**
`app opened → exercise started → exercise completed → Daily Focus completed →
active on 3+ days`

Justo debajo, obligatorio:
> EN: *These checkpoints summarize product progress; they are not a strict
> cohort funnel.*
> ES: *Estos checkpoints resumen el avance dentro del producto; no forman un
> embudo estricto de cohorte.*

⛔ Sin porcentajes entre pasos. ⛔ Sin exigir monotonía a los access checkpoints.

### Progressive disclosure

| Bloque | Visible | Dentro de `<details>` | Summary |
|---|---|---|---|
| Trend | **7 días** | los otros 23 | `Show 23 more days` |
| Ranking | **Top 10** | el resto | explícito, con la cantidad |

⛔ Nada de `More` ambiguo. ⛔ Nunca esconder `generatedAt`, metodología,
warnings ni estados degradados.

### Mobile

Bajar la altura **considerablemente** (hoy **6.794 px a 390 px**), cero overflow
horizontal del body, scroll interno sólo donde haga falta.
⛔ Sin tabs · ⛔ sin `use client` · ⛔ sin acordeones por JavaScript
(`<details>` nativo).

---

## 6. Las restricciones heredadas — cada una costó una ronda

| Restricción | Por qué |
|---|---|
| **El access journey NO es un embudo** | `wallet_ready 17 > login_succeeded 15` es correcto y está medido |
| **Cohorte 0 → «Not enough history yet»**, jamás `0 %` | nadie tuvo oportunidad de volver |
| **`null` → em-dash, NUNCA `0`** | un cero afirma «nadie hizo esto» |
| **La nota de `surface` NULL junto al desglose** | `Learn + Play < Total` por el 15,5 % de filas sin superficie |
| **Cero claves técnicas de eventos** | ⚠️ la RPC emite **`gate_viewed`**, no `web_access_gate_viewed` — mapear sólo el nombre del evento imprimió «Unknown step» en producción |
| **Una URL, sin tabs ni rutas nuevas** | el listing sólo puede declarar una |
| **Sin `"use client"`** | hoy no hay ni uno, y por eso ningún env puede viajar al bundle |
| **`generatedAt` ≠ `census.asOf`** | dos relojes, dos sellos |
| **Sin mints en el trend** | la RPC no los devuelve; recuperarlos reintroduce una lectura truncable |
| **`locale` fuera de toda clave de datos** | dos idiomas, una sola foto |

---

## 7. Riesgos que sobreviven a esta sesión

| # | Riesgo | Nota |
|---|---|---|
| 1 | **Cold start: 1,6–7,3 s de TTFB** | con el sello **sin cambiar** → no es un MISS. **La IA no lo arregla**: reducir HTML ayuda al render, no al TTFB. Es lo primero que vería un reviewer llegando por el listing |
| 2 | **El TTL de 900 s es un PISO** | observado en vivo: una entrada sirvió un sello de 02:33 pasada la ventana antes de revalidar. **Un deploy NO purga esta caché** |
| 3 | **Un `<details>` colapsado puede leerse como dato ausente** | el `summary` tiene que decir qué hay dentro |
| 4 | **«Since MiniPay launch» necesita una fecha que no está en ningún dato** | constante editorial; derivarla cae en el alcance prohibido |
| 5 | **`week3` en cohorte 0 hasta ~2026-08-20** | `session_first_seen` nació el 2026-07-23 |
| 6 | **production y preview comparten base** | toda cifra es la suma de los dos entornos |
| 7 | **`identity.ts` es copia de la derivación de `apps/web`** | sin test cruzado entre apps: si una cambia, el mismo wallet muestra otro avatar en cada superficie |
| 8 | **`grant-shots.spec.ts:260` visita la ruta vieja** | repuntar a `www.chesscito.com/stats` en una iteración de E2E |
| 9 | **Forense pendiente del `null` histórico de `census.total`** | sobre código ya reemplazado; no bloquea nada |

---

## 8. Baselines para no regresar

```
suite landing        230 passed / 24 files · 0 skipped   (correr DESPUÉS del build)
suite web          7.283 passed / 592 files · exit 0
verificador RPC    1.084 / 1.084
altura móvil        6.794 px @ 390 px   ⬅ el número a bajar
altura desktop      6.124 px @ 1280 px
overflow horizontal ninguno en 390 / 1280
```

⚠️ Los guards de `.next/static` **se saltean sin build**: correr la suite del
landing **después** de `pnpm -C apps/landing build` o quedan 3 skipped.

---

## 9. NEXT ACTION

> Implementar la iniciativa en `feat/stats-information-architecture`, **local**,
> siguiendo §5. Validar contra el **HTML servido**, no sólo componentes
> aislados. Revisión visual en **390 / 768 / 1280**. Entregar
> `docs/handoffs/2026-08-05-stats-information-architecture-review.md` y
> **detenerse antes del commit de código**.
>
> ⛔ Sin push · sin deploy · sin redirects · sin cambios de datos.

Al pushear: los **dos commits documentales viajan con el de producto**, en un
solo push y un solo build.
