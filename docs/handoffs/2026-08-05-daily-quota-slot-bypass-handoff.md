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

## 6. Por qué NO desplegué

Pediste desplegar si todo quedaba verde. Todo quedó verde y aun así paré, por dos
razones que no puedo resolver yo:

1. **El push a `origin/main` es tuyo.** El release de producción es
   `origin/production` con el flujo de 6 pasos de `docs/release/release-process.md`,
   y su paso 1 es `git push origin main` — que por decisión tuya hace el founder,
   no yo. `main` local está fast-forward con los dos commits y limpio.
2. **La suite VR no pudo correr entera: disco.** El preflight aborta bajo 10 GB
   libres. Bajé el floor a 6 y la corrida murió a mitad de camino ("11 passed",
   el resto sin correr) porque **la corrida misma consumió 2 GB**: quedaban 6,5 GB
   y ahora quedan 4,5 GB.

   Sobre el VR tengo un argumento, no una medición: **no hay una sola referencia a
   cuota, `slot`, `dailySession` ni `consumedContentIds` en todo `e2e/`**, así que
   ningún fixture llega al límite, `quotaDisplayState` es `null` en todos y los
   dos atributos que saqué ya estaban ausentes. El cambio no puede mover un píxel
   en ningún caso VR. **Pero eso es razonamiento, no la suite en verde** — y ya
   sabemos que un VR puede fotografiar cosas que el razonamiento no anticipa.

   Para correrlo hacen falta ~6 GB. Los candidatos, sin tocar nada todavía:
   `~/.npm` (4,5 GB, cache puro, se reconstruye) y `~/Library/Caches/ms-playwright`
   (1,3 GB, con **dos** Chromium instalados: 1208 y 1234 — solo el nuevo se usa).
   **No toqué `~/Library/pnpm/store`**: son hard links contra los `node_modules`
   vivos.

**Para desplegar, decime una de dos:** liberás disco y corro el VR antes, o lo
damos por no-riesgo y hacés el push. En cualquiera de los dos casos el smoke
dirigido (9 consumidos → 10 permitido → 11 bloqueado → rejugada → carril 2 →
entrada por Daily → PLAY intacto) lo corro yo después del deploy.
