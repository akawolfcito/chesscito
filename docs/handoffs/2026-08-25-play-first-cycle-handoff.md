# Handoff — ciclo Play-First, batch 1

**Fecha:** 2026-08-25 · **Rama:** `main` local, **17 commits sin pushear**
**Deploy:** NO ejecutado. El push lo hace el founder.

---

## Estado: listo para push

| Verificación | Resultado |
| --- | --- |
| Typecheck | limpio |
| Vitest | **719 archivos · 9141 passed · 1 todo** |
| VR (`--project=minipay --update-snapshots=none`) | **68/68**, baselines **82 antes y después** |
| Smoke Learn hub | ✅ (abajo) |
| Migraciones | **ninguna** — no hubo cambios de esquema |
| Idempotencia de Peones | intacta — no se tocó ese código |
| Wallet cruda en analytics | ninguna |

### Smoke — lo que el VR NO cubre

⛔ **El VR verde no probó ninguno de los dos fixes.** `app/dev/learn-hub/fixture.tsx`
construye el `ChallengeProgressView` **a mano** (`window: { kind: "unbounded" }`
hardcodeado, línea 224) sin pasar por `buildChallengeProgressView` ni por el flag.
Por eso `vr18-learn-hub-guest — card in offer` y
`vr18-learn-hub-pro — unbounded window, no countdown` siguieron en verde con el
comportamiento ya cambiado.

Verificado entonces contra la app real, por **aserción de DOM** (no por foto — un
elemento ausente es justo lo que una captura no prueba):

```
challenge_card_present:  0   ← no renderiza con ventas pausadas y sin wallet
offer_state_present:     0   ← no hay oferta
learn_path_rendered:     1   ← el resto del hub intacto
app_error_boundary:      0
console_errors:          0
```

⚠️ El caso inverso (**pase activo → la card sigue igual**) lo cubre
`sales-paused.test.ts`, no el smoke: requiere wallet con entitlement.

---

## Qué entró

| # | Cambio | Commit |
| --- | --- | --- |
| 1 | Season Pass pausado — `isSeasonPassSalesEnabled()`, opt-IN | `3d95937` |
| 2 | PRO deja de ser `unbounded` | `0f58910` |
| 3 | `session_required` deja de ser `score_save_failed` | `4549e4f` |
| 9 | Evidencia de la recompensa | `private/` (gitignored) |
| — | Las tres auditorías | `138143c` |

## Qué NO entró — el siguiente batch

**Acordado con el founder: seguimos inmediatamente con Peones, sin otra auditoría.**

| # | Pendiente | Por qué importa |
| --- | --- | --- |
| **4** | **Instrumentar la compra de Peones** | **El de mayor valor.** Sin esto no hay latencia, conversión ni tasa de fallo. El rail ya tiene las 5 fases como estados y `tx_progress` ya existe: es reuso, no sistema nuevo |
| **6** | **Exponer la compra** | Hoy el shop muestra `item_id 6` (PRO). La micro-compra que sí pueden pagar no tiene vitrina |
| 5 | Metadata económica en `peones_ledger` | La tabla guarda Peones pero no precio ni token |
| 7 | Funnel de minijuegos (24 % open→start) | 181 personas abrieron y no jugaron |
| 8 | Reposicionar Learn | Parcial: pausar el pase ya sacó la narrativa de hábito del centro |

---

## Follow-ups detectados (no bloquean)

1. ⚠️ **El fixture del VR bypasea la lógica real.** Dos baselines fotografían un
   estado que la app ya no produce, y sus nombres ahora mienten
   (`vr18-learn-hub-pro — unbounded window`). El fixture debería construirse con
   `buildChallengeProgressView` en vez de pasar la ventana a mano; hoy el VR de esa
   card no protege nada.
2. `treasury_payment_intents` tiene 24 filas de julio y el canary está OFF: confirmar
   si esa tabla queda muerta.
3. `learn.chesscito.com` responde en **12,7 s** contra 3,3 s de `play` (cold start).

---

## Después del push — qué mirar a los 3–7 días

| Señal | Esperado |
| --- | --- |
| `score_save_failed` | caída de ~96 % |
| `score_save_deferred` | aparece, absorbiendo ese volumen |
| Compras nuevas de Season Pass | **cero** |
| Reportes de pérdida de acceso (pase o PRO) | **cero** — la pausa es sobre la oferta |
| Titulares de PRO | ahora ven contador de días en la card |

## Reactivar la venta

Una variable de entorno y un redeploy. Sin migración, sin cambio de código:
`NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED` en `true`.

## Recompensa pendiente

**1 wallet, $0.33.** Dirección y evidencia en
`private/2026-08-25-challenge-reward-ledger.md` — ahí y no en `docs/`, porque el repo
es público. Transferencia manual, fuera de esta tarea.
