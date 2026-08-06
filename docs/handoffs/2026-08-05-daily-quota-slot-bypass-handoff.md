# Slice: cerrar el bypass de cuota + alinear el límite en 10

**Fecha:** 2026-08-05 · **Branch:** `fix/daily-quota-slot-bypass` → mergeada a `main` **local**
**Commits:** `18f67ba3` (fix) · `2d823abe` (docs de auditoría)
**Estado:** listo para desplegar. **No desplegado** — ver §6.

---

## 1. Diff

`4 archivos, +364 / −21`. Solo `apps/web/src/components/exercises/**`.

### `exercises-screen.tsx` (+20 / −6)

```diff
 export function ExercisesScreen({
   initialPiece = "rook",
   initialAction,
   initialSheet,
-  slot,
   initialContentId,
 }: ExercisesScreenProps = {}) {
-  const isFreeSlot = slot === "daily" || slot === "challenge";
```

```diff
   useEffect(() => {
-    if (!CHESSCITO_LITE_MODE || isFreeSlot) return;
+    if (!CHESSCITO_LITE_MODE) return;
     function read() { /* … getDailySession → setQuotaDisplayState … */ }
     read();
     return subscribeToDailySessionChanges(read);
-  }, [isFreeSlot]);
+  }, []);
```

`slot` sigue en `ExercisesScreenProps` con su doc reescrita: se acepta y se
transporta para los links que ya lo emiten, y **no cambia gating**. No se tocó
`page.tsx` ni ningún CTA, así que `?slot=daily` sigue siendo una URL válida.

### `exercise-drawer.tsx` (+11 / −12)

Se eliminó `isLabReplayable` entera, su `isQuotaLocked` y el `data-quota-locked`
del nodo de carril 2. Queda un comentario que explica por qué no debe volver.

### Tests (+336)

- `__tests__/session-quota-slot-bypass.test.tsx` — nuevo, 13 casos.
- `__tests__/exercise-drawer.test.tsx` — un caso **invertido** (§3).

---

## 2. Tests

| Corrida | Resultado |
|---|---|
| Focal (`session-quota-slot-bypass` + `exercise-drawer`) | **37 passed / 0 failed** |
| Vecinas (`components/exercises`, `lib/daily`, `components/hub`) | **950 passed / 0 failed** |
| Suite completa | **7397 passed / 0 failed** — cola del log limpia, sin `Unhandled Errors` |
| `pnpm exec tsc --noEmit` | **No errors found** |
| `pnpm build` | **verde** |
| `pnpm lint` (apps/web) | **No issues found** |

Cobertura pedida, caso por caso:

| Requisito | Caso |
|---|---|
| entrada normal a `/exercises` | `enforces the limit on no slot (direct entry)` |
| entrada por `?slot=daily` | `enforces the limit on ?slot=daily (hub hero CTA + content loop)` |
| entrada por `?slot=challenge` | `enforces the limit on ?slot=challenge` |
| diez únicos permitidos | `allows ten unique exercises and blocks the eleventh` (primera mitad) |
| el undécimo bloqueado | idem (segunda mitad) |
| rejugar uno anterior | `lets the player replay a completed exercise at the limit` |
| Daily Focus permitido | estructural — ver §3 |
| carril 2 antes y después del límite | `leaves carril 2 open at the limit` + `…below the limit too` |
| refresh conserva la cuota | `survives a refresh — the ledger is the source` |
| cambio de día UTC reinicia | `resets when the UTC day rolls over` |
| PLAY no aplica | `does not apply in PLAY — the quota is a LEARN product` |
| contador no duplica ids | `counts unique ids, not completions` |
| CTA del hub sin sesión ilimitada | `a daily-slot session is not unlimited — the 11th is refused there too` |

⚠️ **Dos notas sobre los tests, porque cambian cómo leerlos:**

1. **"Daily Focus permitido" no tiene un test propio, y es a propósito.** El Daily
   Tactic **no se juega en esta pantalla**: vive en `components/daily/**`,
   `components/hub/hub-daily-tile.tsx` y la ruta `/challenge/daily`, y su
   completación va a `focus_day_ledger`. Nunca monta `ExercisesScreen`, así que
   nunca toca `recordExtraConsumed`. Un test que "verificara" que el Daily no
   consume cuota estaría verificando que dos módulos sin relación no se llaman.
   Lo que sí quedó cubierto es lo que la confusión producía: entrar **por**
   `?slot=daily` ya no regala la sesión.

2. El seeding de los tests escribe **estrellas y ledger juntos**. Sembrar solo el
   ledger construye un jugador que gastó diez slots sin resolver nada, y entonces
   el otro candado del drawer (la senda lineal, `index > lastCompleted + 1`) tapa
   al de cuota — el test pasaría por el motivo equivocado. Lo descubrí porque el
   caso de entrada directa falló en rojo cuando no debía.

---

## 3. Comportamiento exacto del carril 2 (confirmación pedida)

**Antes:** `isLabReplayable` preguntaba si el id `labyrinth:{pieza}:{nodo}` estaba
en `consumedContentIds`. **Nada escribe ese id nunca.** `recordExtraConsumed` tiene
un solo call site en todo el bundle (`exercises-screen.tsx:1772`) y pasa
`kind:"exercise"`. Al llegar al límite la respuesta era `false` para **todo** nodo
de carril 2 no completado ⇒ el carril entero quedaba bloqueado hasta el otro día
UTC. Un candado sin llave, sobre contenido que la cuota no cobra.

**Ahora:**

| Situación | Carril 2 |
|---|---|
| Bajo el límite | Abierto |
| En el límite (10/10) | **Abierto** |
| En hard max (20) | **Abierto** |
| Nodo no desbloqueado por la senda (`node.status === 'locked'`) | Cerrado — regla de camino, no de cuota |
| Nodo con `access: "training_pass"` sin pase | Cerrado — regla comercial, no de cuota |

**No consume cuota** en ninguna de esas situaciones: eso no cambió, porque nunca
consumió. El slice sacó el candado, no el cobro.

---

## 4. Variables en 10 (confirmación pedida)

Valor leído del entorno real, no del listado:

| Proyecto | Entorno | Valor | Tipo |
|---|---|---:|---|
| `lite-chesscito` (learn) | Production | **`"10"`** | Non-sensitive |
| `lite-chesscito` (learn) | Preview | **`"10"`** | Non-sensitive |
| `chesscito` (play) | Production | **`"10"`** | Non-sensitive |
| `chesscito` (play) | Preview | **`"10"`** | Non-sensitive |

⚠️ **Dos cosas que salieron mal en el camino y conviene que sepas:**

- **`vercel env update` reporta "Updated" sin aplicar el valor.** Lo corrí con pipe
  y con redirección de archivo; las dos veces imprimió éxito y el valor siguió en 5.
  Lo mismo `vercel env add` leyendo de stdin: guardó **cadena vacía**. El único
  camino que funciona en esta CLI (58.4.4) es **`--value <v>`**. Si alguna vez
  "actualizaste" una variable por pipe y no la releíste, puede no haber entrado.
- **`--value` guarda como `Sensitive` por defecto, y una variable sensible no se
  puede releer** (`env run` devuelve `""`). Eso me hizo creer que el valor seguía
  mal. Las cuatro quedaron con **`--no-sensitive`**, que es como estaba la original
  y lo que las mantiene auditables.

Efecto secundario a mirar en el dashboard: en `lite-chesscito` la variable pasó de
**una fila** cubriendo `Preview, Production` a **dos filas**, una por target. Mismo
valor efectivo en ambas; solo cambia cómo se ve listada.

Como es `NEXT_PUBLIC_*`, **el 10 no llega a nadie hasta un rebuild real**.

---

## 5. Rollback

Tres palancas independientes, de más barata a más cara:

1. **Solo el límite** (sin tocar código): `vercel env add NEXT_PUBLIC_CHESSCITO_SESSION_LIMIT <target> --project <p> --value 5 --no-sensitive --force --yes` en los cuatro scopes + redeploy. Devuelve el ritmo anterior dejando el bypass cerrado.
2. **Solo el fix**: `git revert 18f67ba3`. Vuelve el bypass de `?slot=daily` y el candado del carril 2. La suite vuelve a verde en la forma vieja porque el test invertido vuelve con él.
3. **Deploy entero**: §4.1 del release process — promover el deployment anterior desde el dashboard (<30 s). Deja el head de git desincronizado, así que sirve para apagar el incendio, no para cerrar el tema.

El modo de falla del env es benigno: con la variable ausente o vacía,
`parseSessionLimit` cae a **10**, que es el valor objetivo.

---

## 5-bis. Disco liberado y corrida VR completa (2026-08-05, ruta estricta)

### Cachés eliminadas

| Cache | Tamaño | Reconstrucción |
|---|---:|---|
| `~/.npm` | 4,5 GB | sola, al próximo `npm` |
| `~/Library/Caches/ms-playwright/chromium-1234` | 356 MB | `playwright install` |
| `~/Library/Caches/ms-playwright/chromium_headless_shell-1234` | 196 MB | idem |

**Espacio libre: 6,5 GB → 12 GB.**

⚠️ **La versión a conservar era la de número MENOR.** `playwright-core@1.58.2`
declara `chromium -> 1208` en su `browsers.json`; el directorio `1234` es el
residuo. "Conservar el más nuevo" habría borrado el navegador en uso. Se
conservaron `chromium-1208`, `chromium_headless_shell-1208`, `webkit-2248` y
`ffmpeg-1011`. No se tocó `~/Library/pnpm/store` ni ningún `node_modules`.

`~/Library/pnpm/store` tiene además un `playwright-core@1.49.1` huérfano
(`pnpm why` sólo reporta 1.58.2); sus navegadores (chromium 1148, webkit 2104)
ni siquiera están en la cache, así que no había nada que preservar por él.

### Preflight

**Nunca se editó.** El `6` de la corrida anterior fue una variable inline en la
línea de comando, no un cambio de archivo: `DEFAULT_MIN_FREE_GB = 10` sigue en
`apps/web/scripts/preflight-disk.ts:20`, el árbol está limpio y el shell no
arrastra `DISK_MIN_FREE_GB`. La corrida completa se hizo con el floor original.

### Resultado: la suite corrió íntegra y está ROJA — desde antes de este slice

**62 casos: 11 pasaron, 51 fallaron. Ninguno omitido.**

⚠️ Corrijo lo que reporté en la vuelta anterior: la lista larga al pie del log
**no eran casos sin correr**, era la enumeración de los 51 fallidos. La corrida
previa tampoco se había "muerto a mitad de camino" — terminó, y estaba roja.

| Causa | Casos |
|---|---:|
| Diferencia de píxeles contra la baseline | **47** |
| `TimeoutError: page.goto` (30 s, compilación fría del dev server) | **4** |
| Snapshot inexistente | 0 |

Las diferencias van de **2% a 50%** de los píxeles.

### No lo causó este slice — medido, no argumentado

Restauré `exercises-screen.tsx` y `exercise-drawer.tsx` a `cceed76b` (el commit
anterior al fix), dejando todo lo demás igual, y corrí el mismo subconjunto
(`support-page` + `vr9-arena-end-state-draw`):

| Fuentes | Resultado |
|---|---|
| Con el fix | 2 failed |
| Sin el fix (`cceed76b`) | **2 failed, idénticos** |

Además, los fallos caen en superficies que el diff no toca: `support-page`,
`terms-page`, `privacy-page`, arena end-states, coach viewer, play/learn hub.

Las baselines se tocaron por última vez el **2026-07-27** (`30919b23`); `main`
avanzó mucho desde entonces. Es **drift de baseline acumulado**, y no lo
re-baselineo por mi cuenta: eso es una decisión, no una limpieza.

---

## 6. Por qué NO desplegué

Pediste desplegar si todo quedaba verde. Todo quedó verde y aun así paré, por dos
razones que no puedo resolver yo:

1. **El push a `origin/main` es tuyo.** El release de producción es
   `origin/production` con el flujo de 6 pasos de `docs/release/release-process.md`,
   y su paso 1 es `git push origin main` — que por decisión tuya hace el founder,
   no yo. `main` local está fast-forward con los dos commits y limpio.
2. **El VR está rojo, y la condición que pusiste era que quedara verde.** Corrió
   íntegro con el floor original y dio 11/62 (§5-bis). El rojo es **anterior a
   este slice y ajeno a él**, medido revirtiendo las fuentes: mismos fallos con y
   sin el fix. Pero la puerta que definiste no se cumple, y re-baselinear 47
   snapshots es una decisión de producto sobre otro trabajo, no parte de este.

**La decisión es tuya, y son tres caminos:**

- **Pushear igual.** El slice está verde donde puede estarlo (7397 unit, tsc,
  build, lint) y el VR rojo no lo involucra. El riesgo que asumís es el que ya
  corría en `main` desde el 27-07.
- **Arreglar las baselines primero**, en su propio slice, y después pushear este.
- **Investigar antes de decidir**: los 4 timeouts huelen a compilación fría del
  dev server (el VR levanta `pnpm dev`, no un build), y podrían no ser drift
  real. Los 47 diffs sí parecen drift acumulado de 9 días de `main`.

En cualquiera de los tres, el smoke dirigido (9 consumidos → 10 permitido → 11
bloqueado → rejugada → carril 2 → entrada por `?slot=daily` y `?slot=challenge`
sin bypass → PLAY intacto) lo corro yo apenas el deploy esté arriba.
