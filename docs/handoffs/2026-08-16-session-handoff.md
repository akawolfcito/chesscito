# Handoff de sesión — el duelo p2p entero, congelado, y una pasada de seguridad

**Fecha:** 2026-08-16
**Estado:** ✅ **P2P DUEL V0 — FROZEN** · ✅ **Phase 0.5 completa**

---

## 1. Dónde arrancar la próxima sesión

⛔ **No con P2P.** Está congelado y la deuda tiene su razón escrita.

**La próxima línea es la de evidencia, ya definida:**

1. Instrumentación de lectura de pagos/balance
2. Clasificación de errores del mint de victoria
3. Instrumentación de fuente de adquisición
4. Observar
5. Experimento Daily-first
6. Corrección del rail de pagos según evidencia
7. Revisión incremental de eficiencia de infraestructura

⚠️ **Lo primero, antes de escribir código: 3 commits sin pushear.**

---

## 2. Qué se hizo

### El duelo p2p, de la Etapa 3 al congelamiento

Etapas 3 (rutas) y 5 (Arena) construidas enteras; la migración aplicada a producción; smoke de
dos dispositivos verde; congelado.

**Documento de cierre:** `docs/handoffs/2026-08-16-p2p-duel-v0-frozen.md` — ahí está todo:
lo que se envió, la puerta de exposición, el trace del poll, la deuda congelada.

### Phase 0.5 — seguridad de lecturas + integridad de recorrido

**Documentos:** `docs/audits/2026-08-16-supabase-server-read-safety-pass.md` y
`docs/audits/2026-08-16-leaders-learn-navigation.md`.

- 30 lecturas server-side clasificadas; **cero arregladas**, porque ninguna probó el defecto
- Privacidad: **no reproducida**, con alcance declarado
- Leaders: la tarjeta semanal llevaba a la superficie equivocada. Arreglada y verificada

---

## 3. Lo que esta sesión enseñó, y conviene no perder

⛔ **688 archivos de tests verdes, VR 67/67 y `tsc` limpio convivieron con un feature que no se
podía usar.** Lo encontró un smoke en un build real. `next dev` no ejecuta lo que rompía.

⛔ **Corregí dos afirmaciones mías** durante la sesión, y las dos importaban:
- Le dije al founder que había dos migraciones pendientes citando memoria de un día antes. Había
  una. **El ledger se mide, no se recuerda.**
- Documenté como hecho que el Data Cache servía lecturas viejas. Una segunda ruta no lo
  reproduce; el mecanismo quedó en `[UNKNOWN]`.

⛔ **La mutación encontró defectos en MIS TESTS tres veces**, no en el código: un guard redundante
que enmascaraba la regla que duplicaba; un test que asertaba sobre `seats.w` cuando el color se
sortea; y uno que asertaba sobre `button[disabled]`, que no existe.

⚠️ **Un grep por archivo subcuenta.** El inventario "de ~25 lecturas" eran 30, porque una ruta
puede leer por un helper.

---

## 4. Estado del repo

| | |
| --- | --- |
| `main` | **3 commits por delante de `origin/main`** |
| Working tree | limpio salvo `docs/research/` (sin trackear, no es de esta sesión) |
| Suite | **689 archivos / 8.453 tests**, `EXIT=0`, 0 errores de worker |
| `tsc` | limpio |
| VR | **67/67**, 81 baselines antes y después |
| Migraciones | **46 = 46**, cero pendientes en las dos direcciones |

---

## 5. Preguntas abiertas

1. **¿Se prende el duelo en producción, y cuándo?** Hoy `NEXT_PUBLIC_ENABLE_DUEL` está cerrado
   ahí a propósito. ⛔ Recordar: producción se despliega **buildeando la rama `production`**,
   nunca promoviendo un deployment de preview.
2. **¿Se borran las filas de prueba de `duels`?** Son 11 y la métrica *"duelos con jugada de cada
   asiento"* arranca contaminada si no se distinguen.
3. **¿MiniPay?** El duelo nunca se jugó completo ahí — apunta a producción, así que sólo se
   verifica al promover.
4. **¿El mecanismo del stale del duelo?** Sigue `[UNKNOWN]`. No urge; el disparador es que
   reaparezca en otra superficie.
5. **¿`purge_duels`?** Sigue sin llamador. No urge.
