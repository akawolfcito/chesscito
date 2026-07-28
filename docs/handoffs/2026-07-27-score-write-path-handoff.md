# Handoff — Auditoría de score y cierre del write path

**Fecha:** 2026-07-27
**Branch:** `main` → pusheado a `origin/main` (`4f16d6c1..34f37fc1`)
**Auditoría:** `docs/product/2026-07-27-score-and-leaders-audit.md`

---

## 1. Qué se hizo

### Auditoría (Fases 1–4 del brief)

Los cuatro conceptos que el brief quería separar **hoy son uno solo**:

| Concepto | Estado real |
|---|---|
| Exercise Score | **No existe.** Hay estrellas 0–3 por ejercicio. |
| Daily Focus Score | **No existe.** El Daily es binario: completado / no. |
| Leaderboard Score | **Lo único que existe.** `Σ★ × 100`, all-time, sin ventana. |
| Proof of Consistency | **No existe.** 2 señales `exists`, 5 `partial`, 4 `missing`. |

Tres hallazgos que cambian la decisión:

1. **🔴 R1 critical** — `POST /api/scores/save` no autenticaba. `player` venía del body,
   `score` solo `> 0`, `saveId` era concat sin secreto, y `enforceOrigin` dejaba pasar
   cualquier request que omitiera `Origin` **y** `Referer`. Un `curl` ponía cualquier wallet
   en el #1, incluida la de otro.
2. **🟠 El score mide inventario, no rendimiento.** Función de una sola variable. `tier`
   (poblado 29 easy / 60 medium / 4 hard) **no lo lee nadie**. Hints, intentos y tiempo no
   afectan nada.
3. **🟠 El desempate es la dirección de wallet.** `ORDER BY total_score DESC, player ASC`.
   Como el empate es el estado *esperado* (catálogo finito), la cabeza de la tabla es un
   ranking alfabético de direcciones.

**Recomendación: ruta D** (rediseñar antes de tocar Leaders) — pero más barata de lo que
suena: `score_saves.created_at` y `Exercise.tier` ya están guardados y ociosos.

### Slice 0 — cerrar el write path (`d7691e31`)

| Propiedad | Antes | Ahora |
|---|---|---|
| Autoría | `player` del body | recuperada de firma EIP-191 |
| Techo | solo `> 0` | `≤ MAX_SCORE_PER_LEVEL` server-side |
| Superficie | inexistente | firmada + contrastada con el deployment |
| Origin sin headers | bypass silencioso y **único** guard | logueado, y ya no autentica nada |
| Agregado | `SUM(...)::int` → *raise* al desbordar | `bigint` |

### Slice 0.1 — sesión de escritura (`ab1170af`)

Una firma por save = un prompt tras casi cada ejercicio. Un control que el jugador aprende a
descartar por reflejo entrena el hábito **opuesto** al que necesita el carril on-chain.

```
POST /api/scores/session/challenge   { wallet } → términos server-issued
POST /api/scores/session/authorize   { message, signature } → token (UNA vez)
POST /api/scores/save   Authorization: Bearer <token>
```

`una firma → una sesión (2h / 25 saves) → N saves silenciosos`. Revocable, que una firma
nunca fue.

### Fix de config (`edee4713`)

Sin `NEXT_PUBLIC_CHAIN_ID`, el challenge salía **200**, pedía la firma al jugador, y recién
ahí moría con 400 `invalid_chain`. Falla cerrado, pero era el feature entero roto sin
diagnóstico. Ahora 503 con el nombre de la variable en el log — que importa el doble porque
Vercel marca las envs como sensibles y las oculta en la UI.

---

## 2. Decisiones y por qué

**EIP-191 y no EIP-712.** Único método ya probado en producción *en este repo* sobre las dos
wallets del producto (`useSignMessage` en el Welcome Gift + `verifyMessage` de viem;
`/dev/sign-probe` lo confirmó en MiniPay real; el embedded de Privy es EOA). EIP-712 exigiría
un `verifyingContract` inexistente. Además el texto firmado **es lo que el jugador ve**: que
nombre los términos es seguridad, no cosmética.

**Una tabla con dos etapas** (`token_hash IS NULL` = challenge pendiente). Es el *mismo
objeto* antes y después de que el jugador acepte. Partirlo obligaría a copiar cada término al
autorizar e inventar qué pasa si la copia falla a medias.

**La wallet sale de la fila, no del body.** "Un token escribiendo en la wallet de otro" deja
de ser un caso *expresable*.

**Solo se guarda el SHA-256.** Hash plano y no KDF: la entrada son 256 bits de CSPRNG, no hay
preimagen adivinable que ralentizar.

**El token vive en memoria del módulo, no en storage.** Persistir una credencial bearer
amplía el radio de exposición a cambio de ahorrar un prompt tras un reload.

**`mode` NO servía como superficie.** Registra cómo se pagó (`free`/`peones`), no de dónde
vino — y hay filas legacy en `peones`, así que ni siquiera es constante.

**Reintento exactamente UNO**, y solo ante `session_expired/revoked/invalid`. Re-firmar no
vuelve válido un score fuera de rango ni recarga un presupuesto gastado.

---

## 3. Estado del deploy

- **DB**: migraciones **aplicadas en Supabase**. Una sola base para preview + prod.
- **VERIFY**: 11/11 OK. 132 filas de `score_saves` intactas, todas `surface = NULL`
  (provenance desconocida — correcto, no una suposición). 0 sesiones.
- **Preview**: tomó el código nuevo.
- **Prod**: sigue con el código anterior y **funciona** — su llamada de 8 args resuelve
  contra la de 9 con `p_surface` default. Verificado empíricamente antes del deploy.

Scripts en `apps/web/supabase/deploy/` (`DEPLOY` / `VERIFY` / `ROLLBACK` + README).

**Orden no negociable:** `SQL → VERIFY → push`. Para rollback: `ROLLBACK.sql` **antes** de
revertir el código, o todos los saves fallan con 500.

---

## 4. Verificación ejecutada

- Suite: **6265 passing / 543 archivos, exit 0**. Typecheck, lint y `next build` limpios.
- Tests de endpoint con **firmas viem reales**, no un verifier mockeado — un mock habría
  testeado el mock.
- **Concurrencia contra Postgres real** (no el mock single-thread de vitest):
  - 12 conexiones sobre una sesión de `max_saves=3` → **3 `consumed`, 9 `exhausted`**.
  - 12 racers sobre un challenge → **1 `authorized`, 11 `already_used`**.
  - `CHECK` rechaza `used_saves > max_saves` incluso ante un `UPDATE` a mano.
- **R13 probado:** `total_score = 4.000.000.000` devuelto como `bigint` en vez de *raise*.
- Ciclo completo deploy → rollback → código viejo funciona → re-deploy.
- **No ejecutado:** smoke en device real de MiniPay/Privy (requiere hardware).

---

## 5. Próximos pasos

1. **Probar el prompt en device real.** Un ejercicio con wallet conectada en preview: **una**
   firma, y los siguientes ninguna. Log: `session_authorized`.
2. **Decidir cuándo promover a prod.** Ahí los jugadores reales empiezan a firmar.
3. **Ignored Build Step de landing** (§6).
4. **Slice 2 — ventana weekly.** Sin migración (`created_at` ya está). Mata R3 y R4.
5. **Slice 3 — identidad de intento.** Único hueco estructural; Exercise Score y Daily Focus
   Score dependen de él.

---

## 6. Builds de `apps/landing` — diagnóstico (verificado contra la doc de Vercel)

**Medición:** de los últimos 133 commits, **3 tocaron `apps/landing`** y 88 tocaron
`apps/web`. Casi todos esos builds son desperdicio.

### Config actual (confirmada en dashboard)

- Root Directory: `apps/landing` ✅ **está bien puesto** — la primera hipótesis (que estuviera
  en la raíz) era **incorrecta**.
- "Skip deployments when there are no changes to the root directory or its dependencies":
  **Enabled** ✅
- Ignored Build Step: `git diff HEAD^ HEAD --quiet -- .`

### El Ignored Build Step NO resuelve el problema

Doc oficial (`/docs/monorepos#ignoring-the-build-step`), textual:

> *"Canceled builds initiated using the Ignored Build Step **count towards your deployment and
> concurrent build limits**"*

y sobre el skip nativo:

> *"This setting does **not** occupy concurrent build slots, **unlike the Ignored Build Step
> feature**, reducing build queue times."*

Es decir: **aunque el comando funcionara perfecto, el build cancelado igual ocupa el slot** y
los deploys de web siguen haciendo cola. No ataca la queja original ("los deploys tardan más").

Además el comando tiene dos defectos propios:

1. **`HEAD^ HEAD` mira UN solo commit.** Hoy se pushearon 5 de golpe; un cambio de landing en
   el commit 2 de 5 **no se detecta y landing queda stale** — fallo silencioso, peor que
   buildear de más.
2. **Vercel clona shallow**: `HEAD^` puede no existir → git falla → exit ≠ 0/1 → buildea.

La doc confirma que el comando **sí** corre dentro del Root Directory, así que el `.` estaba
bien. Ese no era el problema.

### El motivo real de que landing se deploye siempre

Doc, requisitos del skip nativo:

> *"Changes that are **not a part of the workspace definition** will be considered **global
> changes and deploy all applications** in the repository."*

`pnpm-workspace.yaml` define `packages: ["apps/*"]`. Todo lo que esté fuera de `apps/` es un
cambio global.

**Medición: 101 archivos fuera de `apps/*` en los últimos 133 commits** —
`docs/` 53, `tools/` 26, `SESSION.md` 19, `pnpm-lock.yaml` 2, `README.md` 1.

O sea: **cada handoff que escribimos fuerza un deploy de landing.** Es política del proyecto
escribir uno por sesión, así que se dispara todo el tiempo. El commit `b62519ec` de esta misma
sesión (docs + SESSION.md) lo hizo.

### Requisitos del skip nativo — se cumplen todos

| Requisito | Estado |
|---|---|
| Repo en GitHub | ✅ `akawolfcito/chesscito` |
| Workspaces npm/yarn/pnpm/Bun | ✅ `pnpm-workspace.yaml` + `packageManager: pnpm@8.10.0` |
| `name` único por package | ✅ `landing` |
| Deps entre packages explícitas | ✅ landing no tiene deps de workspace (solo next, react, next-intl, sharp) |

### Recomendación

1. **Ignored Build Step → `Automatic`** (borrar el comando custom). No ahorra slot, y su
   `HEAD^` puede dejar landing stale. El toggle nativo ya hace el trabajo, mejor.
2. **Dejar el toggle nativo Enabled** (ya lo está).
3. **Aceptar que los commits que tocan `docs/`, `tools/` o `SESSION.md` deployan todo.** Es
   inherente al mecanismo: no hay forma de declararle a Vercel que una carpeta fuera del
   workspace es irrelevante. Si molesta lo suficiente, la única palanca real es **no mezclar
   docs con código en el mismo push** — pero eso es fricción diaria a cambio de un build de
   landing, y probablemente no valga la pena.

⚠️ **Corrección de una recomendación anterior de esta sesión:** llegué a sugerir
`npx turbo-ignore`. Sigue siendo un Ignored Build Step, así que **también consumiría slot**.
La doc solo lo menciona (vía `turbo query`) para monorepos que **no cumplen** los requisitos
del skip nativo — no es el caso acá.

---

## 7. Open questions

- **¿Cuándo se promueve a prod?** El texto del prompt (`maxSaves: 25`, `2h`) pasa a ser
  user-facing ahí.
- **¿Se separa el leaderboard por superficie?** El dato ya está etiquetado desde hoy, pero el
  agregado sigue mezclando learn y play (R12 mitigado, no cerrado). Es decisión de producto.
- **¿Cuándo se cierra el carril on-chain?** `/api/sign-score` y `/api/cache-score` conservan
  el defecto de R1. Cuesta gas, no está cerrado.
- **¿Los `backfill_streak` de `focus_day_ledger` se excluyen de rewards?** La migración lo
  advierte; nadie lo decidió todavía.

---

## 8. Gotchas encontrados hoy

- **El SQL Editor de Supabase muestra solo el ÚLTIMO statement.** El VERIFY original eran 8
  SELECTs sueltos → se veía 1 y parecía que estaban los 8. Un verify que da falsa
  tranquilidad es peor que no tenerlo. Reescrito con UNION ALL.
- **`NOTIFY pgrst, 'reload schema'` no puede vivir en la migración.** PostgREST cachea las
  firmas; sin el reload, `supabase.rpc()` sigue viendo la vieja y tira `PGRST202`.
- **`CREATE OR REPLACE VIEW` no puede cambiar el tipo de una columna.** DROP + CREATE en
  orden de dependencia.
- **Dropear la firma vieja Y la nueva antes de crear.** Una función con un param opcional
  extra convive con la de menos args y la llamada queda ambigua en runtime.
- **Vercel marca las env vars como sensibles por defecto.** Un `NEXT_PUBLIC_*` marcado así
  no está protegido — Next lo inlinea en el bundle igual.
- **zsh `noclobber`**: un `>` sobre un archivo existente falla y el pipeline anterior "pasa"
  en silencio. Me hizo leer un archivo viejo y reportar un resultado que no era de esa
  corrida. Verificar que el archivo se escribió, no que el comando salió 0.
