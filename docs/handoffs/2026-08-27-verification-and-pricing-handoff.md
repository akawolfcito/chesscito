# Handoff — verificación completa, `/pricing` y la pausa del pase en el landing

**Fecha:** 2026-08-27 · **Rama:** `main` local, **37 commits sin pushear**
**Deploy:** NO ejecutado. El push lo hace el founder.

---

## Estado: listo para push

| Verificación | Resultado |
| --- | --- |
| Typecheck `apps/web` | limpio |
| Typecheck `apps/landing` | limpio |
| Vitest `apps/web` | **724 archivos · 9191 passed · 1 todo** (147 s) |
| Vitest `apps/landing` | **27 archivos · 271 passed** |
| VR (`--project=minipay --update-snapshots=none`) | **68/68**, baselines **82 antes y después** |
| Smoke DOM del hub Learn | ✅ 8/8 (abajo) |
| Imágenes de `/pricing` | ✅ 5/5 decodifican, cero 4xx |
| Migraciones | **ninguna** |

⚠️ Los 724 archivos son mi propia medición en `main` limpio hoy. Es el número
contra el que hay que comparar la próxima corrida: **si BAJA, la corrida no vale**
(workers que no arrancan por máquina ocupada). La duración se mantuvo en 147 s.

---

## ⛔ El VR verde NO prueba los dos cambios más recientes del hub

`app/dev/learn-hub/fixture.tsx` **no monta el chip del Inbox ni el panel del
hábito**. Por eso las 82 baselines quedaron intactas: no es que no cambió nada,
es que la foto no los mira. Es el follow-up #1 del handoff anterior, todavía
abierto.

Verificado entonces por **aserción de DOM** contra la app real
(`NEXT_PUBLIC_CHESSCITO_MODE=learn`, puerto 3002, env del VR pineada):

```
hub de Learn renderiza .................. 1
rail del camino ......................... 1
panel del hábito (challenge-progress) ... 1
sus siete letras de día ................. 7
chip del Inbox .......................... 0   ← correcto, ver abajo
cotiza "$0.99" / "Season Pass" .......... no
error boundary .......................... 0
errores de consola ...................... 0
```

⚠️ **El chip ausente es la expectativa correcta, no un hueco.** `inbox-chip.tsx`
hace `if (!address) return null`: un visitante desconectado no tiene inbox. Su
caso montado lo cubren los unit tests. Afirmar "presente" ahí habría sido una
prueba que sólo podía pasar por accidente.

---

## Qué entró hoy

| Cambio | Commit |
| --- | --- |
| `/pricing`: etiqueta "Most flexible" en la card destacada | `d3c1633` |
| El ribbon deja de mostrar un filo pálido, y más compacto | `bf67b47` |
| El carrusel del landing dejaba de cotizar el pase pausado | `311fa37` |
| `/pricing` dejaba cuatro imágenes fuera de todo catálogo | `5973057` |

### La pausa del pase no había llegado al landing

El slide 2 del onboarding mostraba **"21-Day Season Pass · $0.99"** a cada
visitante nuevo, dos días después de pausar la venta. La pausa se implementó en
`apps/web` y **el landing es otra app con su propio bundle de copy**; ni un error
de tipos ni un build roto podían señalarlo. Ahora lo sostiene
`paused-pass-is-not-advertised.test.ts`, falsificado (con la flag en `false` da 3
rojas). También salió "Season Pass incluido" de los beneficios de PRO en EN y ES.

Reactivar: `SEASON_PASS_SALES_PAUSED = false` en
`apps/landing/src/lib/onboarding/sales.ts`. Componente, estilos y textos intactos.

### Cuatro imágenes sin catálogo en `/pricing`

El wordmark y las tres piezas del medallón eran **copias byte a byte** de arte
que ya tenía dueño. Reemplazar el logo o una pieza en el theme-builder habría
dejado `/pricing` con la versión vieja para siempre, sin un solo error. El
wordmark ahora apunta a `landing.slide1-title`; las piezas van por
`SHARED_LANDING_ASSETS` + `pnpm art:sync-landing`. Slot nuevo: uno solo,
`landing.pricing-bg` (superficie `landing`: 19 → 20).

⚠️ Las piezas eran **invisibles** para el audit porque la página compone su ruta.
Ahora tienen aserción por nombre, como CandyIcon.

---

## Qué NO entró — el siguiente batch, sin cambios

| # | Pendiente | Por qué importa |
| --- | --- | --- |
| **4** | **Instrumentar la compra de Peones** | **El de mayor valor.** Sin esto no hay latencia, conversión ni tasa de fallo. Reuso: el rail ya tiene las 5 fases y `tx_progress` existe |
| **6** | **Exponer la compra** | El shop muestra `item_id 6` (PRO). La micro-compra que sí pueden pagar no tiene vitrina |
| 5 | Metadata económica en `peones_ledger` | Guarda Peones, no precio ni token |
| 7 | Funnel de minijuegos | 181 personas abrieron y no jugaron (24 % open→start) |
| 8 | Reposicionar Learn | Parcial: pausar el pase ya sacó el hábito del centro |

## Follow-ups abiertos (no bloquean)

1. ⚠️ **El fixture del VR bypasea la lógica real.** Dos baselines fotografían un
   estado que la app ya no produce y **sus nombres mienten**
   (`vr18-learn-hub-pro — unbounded window`). Debería construirse con
   `buildChallengeProgressView`. Hoy el VR de esa card no protege nada.
2. `/es/es/arena` — el link de duelo duplica el locale. Reproducible, diferido.
3. `treasury_payment_intents`: 24 filas de julio con el canary OFF.
4. `learn.chesscito.com` responde en 12,7 s en frío contra 3,3 s de `play`.

## Del founder

- **Push de los 37 commits** (app + landing). ⚠️ `chesscito-landing` despliega
  **producción** al pushear a `main`, sin preview.
- **Transferencia manual de $0.33** a la wallet en
  `private/2026-08-25-challenge-reward-ledger.md`.
