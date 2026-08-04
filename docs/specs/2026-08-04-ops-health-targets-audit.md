# `pnpm ops:health` — auditoría de targets

**Fecha:** 2026-08-04 · **Estado: ✅ IMPLEMENTADO.**

> ## 📄 Documento operativo vigente
>
> Para **usar** los targets, leé
> **[`docs/runbooks/launch-health-monitor.md`](../runbooks/launch-health-monitor.md)** §3 y §3bis.
> Este archivo es el registro de auditoría: qué inspeccionaba el monitor antes,
> qué se midió, y qué se decidió.

---

## 0. Estado de implementación

Entregado en `feat(ops): add production and preview target profiles`:

```bash
pnpm ops:health              # production (default)
pnpm ops:health:preview      # preview
pnpm -C apps/web exec tsx ../../scripts/ops/launch-health-snapshot.ts --target preview
```

Snapshots en `artifacts/ops/production/` y `artifacts/ops/preview/`,
`SNAPSHOT_SCHEMA_VERSION` = 2, validación cruzada de `target` + `githubCommitRef`,
probe del dominio público, y `target_mismatch` como **no observable**.

### Dos defectos que sólo aparecieron al correrlo

**1. Vercel codifica preview como `target: null`.** La clave está presente y el
valor es `null` — *ese* es el marcador de preview, no un dato faltante. Mi
validación lo leía como desconocido, así que **cada corrida preview reportaba
mismatch contra sí misma**. Normalizado, con los valores inesperados pasando
derecho para que sigan fallando ruidosamente.

**2. `pnpm run` colapsa todo exit no-cero a 1.** Medido capa por capa: el script
sale 3, `pnpm -C apps/web exec` preserva el 3, y `pnpm run ops:health` lo
convierte en 1. Cambiar `--filter` por `-C` arregla la capa de `exec` pero no la
de `run`. Es una limitación del script runner, documentada en el runbook §4 y en
la cabecera del script.

### Cambio de estado del Usage API

En la auditoría original `vercel usage` respondía **404** (el plan Hobby no
exponía el endpoint de costos). Con el proyecto ya en **Pro** y `VERCEL_TOKEN`
configurado, la respuesta pasó a ser **HTTP 400**.

**Eso cambia el diagnóstico, no la conclusión.** 401 y 403 son los códigos de
credencial inválida o permiso insuficiente; **400 dice petición mal formada**, lo
que apunta a la forma de la llamada — endpoint, parámetros o scope de equipo —
antes que a los permisos del token. Sigue **no observable**, y por eso el informe
sigue saliendo `(partial)`. Investigarlo es la próxima acción, y **no debe
asumirse que el token está mal hasta inspeccionar el cuerpo redactado**.

---

**Lo que sigue es la auditoría tal como se aprobó**, con el estado previo del
monitor y las mediciones que fundamentaron el diseño. No se reescribió.

---

## 1. Qué inspeccionaba ANTES de este cambio

### 1.1 El código, literal

```ts
// collectors/vercel.ts:40
export const VERCEL_PROJECTS = ["chesscito", "lite-chesscito"] as const;

// :297  — `--prod` HARDCODEADO, sin forma de pedir otra cosa
["ls", project, "--prod", "--json", "--limit", "1"]

// :321  — los logs van contra la URL del DEPLOYMENT, no contra un dominio
["logs", `https://${deployment.url}`, "--json", "--limit", "100"]
```

### 1.2 Consecuencias, medidas

| Hecho | Detalle |
|---|---|
| **Solo production** | `--prod` fijo. No hay manera de mirar preview |
| **Nunca toca los dominios públicos** | usa `chesscito-dx6uxn4l3-goodwolf.vercel.app`, no `play.chesscito.com` |
| **El informe no dice qué target miró** | se infiere de que siempre es production |
| **Snapshots en un solo directorio** | `artifacts/ops/` plano → un `latest.json` compartido |
| **Landing fuera de alcance** | `chesscito-landing` (www) nunca se consultó, y así queda |

### 1.3 El riesgo que esto ya crea

`latest.json` es **uno solo**. Si mañana existiera un modo preview, dos corridas
alternadas producirían diffs cruzados: *preview vs production* presentado como si fuera
*ahora vs antes*. Es exactamente la comparación incompatible que el monitor rechaza en
otros ejes, y aquí entraría por la puerta de atrás.

---

## 2. Topología real (confirmada por el founder + verificada)

| Dominio | Proyecto Vercel | Target | Rama | Alcance |
|---|---|---|---|---|
| `www.chesscito.com` | `chesscito-landing` | production | — | **fuera del monitor** |
| `play.chesscito.com` | `chesscito` | production | `production` | ✅ perfil production |
| `learn.chesscito.com` | `lite-chesscito` | production | `production` | ✅ perfil production |
| `preview.chesscito.com` | `chesscito` | preview | `main` | ✅ perfil preview |
| `learn-preview.chesscito.com` | `lite-chesscito` | preview | `main` | ✅ perfil preview |

`lite.chesscito.com` es un alias adicional del mismo deployment que `learn.chesscito.com`
— **no es un target aparte**, y no lo trato como tal.

### 2.1 Verificaciones hechas

Los cuatro dominios responden **HTTP 200**.

`vercel ls --environment production|preview` separa limpio, con los dos campos que
permiten validar:

```
--environment production → target=production  ref=production  sha=986bb38320d9
--environment preview    → target=preview     ref=main        sha=5d6083f8aa49
```

**Dos señales independientes**, y ese es el punto: `target` lo dice Vercel, `ref` lo dice
git. Un perfil que coincida en una y no en la otra es sospechoso y debe rechazarse.

### 2.2 🔴 Ahora mismo los dos targets corren commits DISTINTOS

Tras el push a `main`, medido en este momento:

| Proyecto | Target | Rama | Commit |
|---|---|---|---|
| `chesscito` | production | `production` | **`986bb38320d9`** |
| `chesscito` | preview | `main` | **`5d6083f8aa49`** |
| `lite-chesscito` | production | `production` | **`986bb38320d9`** |
| `lite-chesscito` | preview | `main` | **`5d6083f8aa49`** |

`origin/main` = `5d6083f8` · `origin/production` = `986bb383`.

**Preview lleva 7 commits de ventaja** — incluido el monitor entero, que en production
todavía no existe.

> Esto deja de ser hipotético. Un monitor que no distingue targets, apuntado a preview y
> comparado contra un `latest.json` de production, reportaría *"el commit desplegado
> cambió de 986bb383 a 5d6083f8"* — como si production hubiera avanzado. **No avanzó.**
> Son dos sistemas distintos leídos como uno solo a lo largo del tiempo, que es
> exactamente el error que el guard de §3.3 impide.
>
> Y la etiqueta `SHARED DATABASE` (§3.4) pasa a ser imprescindible por la misma razón:
> los dos entornos escriben en la MISMA base, así que las métricas de Supabase de una
> corrida `--target preview` incluyen todo el tráfico de production.

---

## 3. Diff propuesto

**Sin cambios en umbrales ni en la lógica de clasificación.** Solo selección de target,
etiquetado y rutas de snapshot.

### 3.1 `scripts/ops/lib/target.ts` — NUEVO

```ts
export type OpsTarget = "production" | "preview";
export const DEFAULT_TARGET: OpsTarget = "production";

export type TargetProfile = {
  target: OpsTarget;
  /** Rama que Vercel debe reportar. La segunda señal de validación. */
  expectedGitRef: string;
  projects: Array<{
    project: "chesscito" | "lite-chesscito";
    /** Dominio público. Documental y para el informe. */
    domain: string;
    label: "play" | "learn";
  }>;
};

export const TARGET_PROFILES: Record<OpsTarget, TargetProfile> = {
  production: {
    target: "production",
    expectedGitRef: "production",
    projects: [
      { project: "chesscito",      domain: "play.chesscito.com",  label: "play"  },
      { project: "lite-chesscito", domain: "learn.chesscito.com", label: "learn" },
    ],
  },
  preview: {
    target: "preview",
    expectedGitRef: "main",
    projects: [
      { project: "chesscito",      domain: "preview.chesscito.com",       label: "play"  },
      { project: "lite-chesscito", domain: "learn-preview.chesscito.com", label: "learn" },
    ],
  },
};

/** `--target preview`. Un valor desconocido es un error del operador, no un default. */
export function parseTarget(argv: string[]): OpsTarget { … }
```

**Por qué un valor inválido falla en vez de caer al default:** `--target prod` (un typo
plausible) devolvería silenciosamente production, y el operador creería estar mirando
preview. Falla con exit **3** — error del monitor, no del sistema.

### 3.2 `collectors/vercel.ts` — MODIFICADO

```diff
-["ls", project, "--prod", "--json", "--limit", "1"]
+["ls", project, "--environment", profile.target, "--json", "--limit", "1"]
```

Y la validación cruzada, **el requisito central**:

```ts
/**
 * Un deployment que no corresponde al perfil pedido se RECHAZA.
 *
 * El modo de fallo es silencioso y caro: pedir `--target preview` y recibir
 * production haría que alguien tomara decisiones de despliegue leyendo el
 * sistema equivocado. Se validan las DOS señales, porque son independientes:
 * `target` viene de Vercel, `githubCommitRef` viene de git, y un desacuerdo
 * entre ellas significa que la topología cambió.
 */
function validateTargetMatch(d: VercelDeployment, p: TargetProfile):
  | { ok: true }
  | { ok: false; reason: string };
```

Resultado nuevo por proyecto:

```ts
| { project; status: "target_mismatch"; expected; actual; reason }
```

Se renderiza como **eje no observable**, no como rojo: el sistema puede estar
perfectamente; lo que falló es que el monitor no pudo mirar lo que se le pidió.

### 3.3 `lib/snapshot-store.ts` — MODIFICADO

```diff
-const dir = path.join(repoRoot, "artifacts", "ops");
+const dir = path.join(repoRoot, "artifacts", "ops", target);
```

```
artifacts/ops/production/{stamp}.json|.md + latest.json|.md
artifacts/ops/preview/{stamp}.json|.md + latest.json|.md
```

Y el envelope gana `target`, con el guard correspondiente:

```diff
 export type SnapshotEnvelope = {
   schema_version: number;
+  target: OpsTarget;
   …
```

```ts
// checkCompatibility
if (previous.target !== current.target) {
  return { comparable: false, reason: `snapshot de ${previous.target} vs ${current.target}` };
}
```

**Doble defensa a propósito.** Los directorios separados hacen improbable el cruce; el
guard lo hace imposible incluso si alguien copia un `latest.json` a mano. Es la misma
regla que ya rige `schema_version`.

⚠️ **`SNAPSHOT_SCHEMA_VERSION` 1 → 2.** El envelope cambia de forma, así que los
snapshots viejos dejan de ser comparables — y eso es correcto: fueron tomados sin saber
de qué target hablaban.

### 3.4 `lib/render.ts` y el informe — MODIFICADO

```
────────────────────────────────────────────────────────────────
CHESSCITO — LAUNCH HEALTH        2026-08-04T07:22:55Z
                                 2026-08-04 02:22:55 (Bogotá)
TARGET: production                                    ← NUEVO
ESTADO: 🟢 GREEN (partial)
────────────────────────────────────────────────────────────────

VERCEL  [parcial]
  play   · play.chesscito.com                         ← NUEVO: dominio
     deployment dpl_3Bff4CxEqfA3sX7WVdGtSc61bBJc      ← NUEVO: ID
     target     production ✓                          ← NUEVO: validado
     commit     986bb38320d9 (ref production)
     muestra de logs: 52 requests (de 100 crudas) en 88s
  learn  · learn.chesscito.com
     …

SUPABASE  [observable]  ⚠️ SHARED DATABASE            ← NUEVO
  Sus métricas NO se separan por target: production y preview escriben en la
  MISMA base. Las filas, el ritmo y las proyecciones de este bloque son la
  suma de ambos, y no son atribuibles a uno solo.
```

**Sobre la etiqueta de Supabase:** es el matiz que más fácil se malinterpreta. Un informe
que dice `TARGET: preview` invita a leer *todo* como preview, y las métricas de la base
serían las de los dos entornos sumados. Sin ese aviso, un pico causado por producción se
leería como causado por preview.

### 3.5 `package.json` — MODIFICADO

```diff
-"ops:health": "pnpm --filter web exec tsx ../../scripts/ops/launch-health-snapshot.ts"
+"ops:health": "pnpm --filter web exec tsx ../../scripts/ops/launch-health-snapshot.ts --"
```

```bash
pnpm ops:health                       # production (default)
pnpm ops:health -- --target preview
```

⚠️ **El `--` es obligatorio con pnpm** para que el flag llegue al script y no lo consuma
pnpm. A verificar en la implementación; si molesta, la alternativa es un segundo script
`ops:health:preview`.

### 3.6 Tests nuevos (~20)

| Qué se fija |
|---|
| default es production sin flag |
| `--target preview` selecciona el perfil preview |
| un `--target` inválido **falla**, no cae al default |
| `--environment` recibe el target pedido, no `--prod` |
| production que devuelve un deployment preview → `target_mismatch` |
| preview que devuelve production → `target_mismatch` |
| `target` correcto pero `githubCommitRef` inesperado → mismatch |
| un mismatch es **no observable**, no rojo |
| snapshots van a `artifacts/ops/{target}/` |
| `latest.json` de production no se lee en una corrida preview |
| el diff se rechaza entre snapshots de distinto target |
| `schema_version` 1 no se compara con 2 |
| el informe imprime `TARGET:` |
| el informe muestra dominio + deployment ID + SHA + target por proyecto |
| Supabase sale rotulado `SHARED DATABASE` |
| umbrales sin cambios |

---

## 4. Lo que NO cambia

- Umbrales y lógica de clasificación — intactos.
- Colectores de Supabase y Upstash — solo se agrega el rótulo de compartida.
- Solo lectura, y las mismas garantías de redacción.
- `chesscito-landing` (www) sigue fuera de alcance.

---

## 5. Alcance estimado

| Archivo | Cambio |
|---|---|
| `scripts/ops/lib/target.ts` | nuevo, ~70 líneas |
| `scripts/ops/collectors/vercel.ts` | perfil + validación cruzada, ~60 |
| `scripts/ops/lib/snapshot-store.ts` | subdirectorio + guard, ~20 |
| `scripts/ops/lib/render.ts` | línea TARGET + bloque por proyecto, ~30 |
| `scripts/ops/launch-health-snapshot.ts` | parseo de flag + rótulo Supabase, ~40 |
| `scripts/ops/__tests__/target.test.ts` | nuevo, ~20 tests |
| tests existentes | ajuste por el envelope con `target` |
| `package.json` | `--` |
| `docs/runbooks/launch-health-monitor.md` | sección de targets |

**Dos commits:**

1. `feat(ops): add production and preview target profiles` — código + tests
2. `docs(ops): document target selection in the monitor runbook`

---

## 6. Preguntas antes de implementar — ✅ RESUELTAS

1. ~~¿`pnpm ops:health -- --target preview` o un script aparte?~~ → **ambos**:
   `pnpm ops:health:preview` como alias cómodo, y `--target` como forma técnica.
2. ~~¿`target_mismatch` no-observable o amarillo?~~ → **no observable**, confirmado.
3. ~~¿Los snapshots viejos se borran?~~ → **se dejan intactos**; son v1 y no se
   comparan con v2.

*(Se conservan abajo tal como se plantearon.)*

### Enunciado original

1. **¿`pnpm ops:health -- --target preview` es aceptable**, o preferís un
   `ops:health:preview` aparte que evite el `--`?
2. **¿Un `target_mismatch` debe ser no-observable o amarillo?** Propongo no-observable: no
   dice nada sobre la salud del sistema, solo que el monitor no encontró lo que buscaba.
   Amarillo lo mezclaría con problemas reales.
3. **¿Los snapshots ya existentes en `artifacts/ops/` se borran o se dejan?** Al estar
   gitignoreados y quedar huérfanos por el cambio de esquema, propongo dejarlos: el
   directorio nuevo los ignora y desaparecen solos al limpiar.
