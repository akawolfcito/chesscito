# Handoff — verificación, `/pricing`, la pausa cableada, y qué hace la gente

**Fecha:** 2026-08-27 · **Rama:** `main` local, **45 commits sin pushear**
**Deploy:** NO ejecutado. **Congelado a pedido del founder**: la próxima sesión empieza con
más preguntas sobre los datos, **antes** de cualquier push o cambio → ver
[Dónde retomar](#-dónde-retomar--la-próxima-sesión-empieza-acá).

---

## Estado: listo para push

| Verificación | Resultado |
| --- | --- |
| Typecheck `apps/web` / `apps/landing` | limpio en las dos |
| Vitest `apps/web` | **725 archivos · 9207 passed · 1 todo** (154 s) |
| Vitest `apps/landing` | **27 archivos · 274 passed** |
| Vitest `scripts/ops` | **16 archivos · 457 passed** |
| VR (`--project=minipay --update-snapshots=none`) | **68/68**, baselines **82 antes y después** |
| Smoke DOM del hub Learn | ✅ 8/8 |
| Imágenes de `/pricing` | ✅ 5/5 decodifican, cero 4xx |
| SQL nuevo de ops | ✅ corrido contra `postgres:16-alpine` real |
| Migraciones | **ninguna** |

⚠️ Los 725 archivos son mi medición en `main` limpio hoy. Es el número contra el que
comparar la próxima corrida: **si BAJA, la corrida no vale** (workers que no arrancan por
máquina ocupada). La duración se mantuvo en ~150 s.

---

## 📊 Qué ven HOY los que pagaron — medido en producción

La pregunta era si la pausa golpea a alguien que puso dinero. **No golpea a nadie**, y el
dato dice algo más útil todavía: **la exposición se termina sola el 2026-09-13**.

### Los tres grupos, sin solapamiento entre ellos

| Situación | Personas | Vence | Qué ve en el hub |
| --- | ---: | --- | --- |
| **Pase ACTIVO** (ninguno con PRO) | **11** | 2026-09-02 → **2026-09-13** | Su card normal, con días restantes. **Sin cambios** |
| **PRO activo** (sin pase vigente) | **5** | 2026-08-31 → 2026-09-13 | Card normal, y **ahora con contador** |
| Todo vencido | 5 | ya vencieron | Panel de hábito, sin oferta |

⚠️ **PRO son 7 personas, no 8.** Ese 8 eran *filas*: hay **1 renovación**, la única recompra
de todo el producto. **El pase tuvo 0 renovaciones en 17 ventas.**

⚠️ Los 5 de PRO incluyen a quien nunca compró un pase; la consulta no los separa de quien
lo tuvo y se le venció. No cambia la conclusión, pero el número no es "5 ex-compradores".

### ⛔ Y la lectura de "10 nunca jugaron un día" era engañosa

`docs/audits/2026-08-27-what-buyers-actually-did.md` mide qué hicieron, no sólo si hicieron
el daily. **22 de los 24 compradores jugaron.** Sólo 2 compraron y no tocaron nada.

**13 de 24 jugaron sin registrar jamás un Focus Day.** El problema nunca fue que no
vinieran: fue que **lo que hicieron no era lo que contaba**. Y de los que hicieron la táctica
diaria sin que se les registrara un día, **3 la hicieron con el pase activo y el ledger
vivo** — debió contar y no contó.

⚠️ Causa más probable (hipótesis, no medida): `use-focus-day-recorder.ts:92` exige
`CHESSCITO_LITE_MODE`, así que **el Focus Day sólo se escribe en el deploy de LEARN**. Quien
compró el pase y hace su daily en PLAY gana Peones, ve su racha, y su reto no avanza — sin
que nada se lo diga. Confirmarlo exige cruzar `account_ref` (HMAC) con `analytics_events`.

Eso **no cambia la decisión de pausar, cambia el motivo**: no se pausó porque los
compradores fueran fantasmas, sino porque vendíamos un reto cuyo contador podía no moverse
aunque el jugador viniera todos los días.

### Lo que cada grupo experimenta

**Los 11 con pase activo: nada cambia.** Verificado en `challenge-card-view.ts` —
`salesPaused` sólo afecta a `loading` y a `none`. Un entitlement activo cae a la card de
siempre. Nadie pierde lo que compró, que era la condición innegociable.

✅ **Y su parpadeo quedó arreglado** (`c6a1dae`). Era el hallazgo #3 del review: mientras el
entitlement resolvía, la card afirmaba la ausencia y soltaba su contador y sus días, para
traerlos de vuelta un instante después. Ahora `unavailable` distingue `pending` — los dos
muestran el panel de hábito y ninguno la oferta, pero sólo el resuelto colapsa el layout.
⛔ La caja reservada queda **vacía**: nada de "0 de 21" para alguien cuyo ledger no contestó.

**Los 5 de PRO ven un cambio real y deseado.** Antes su ventana se reportaba `unbounded`
(sin contador); ahora ven los días que les quedan. **El primero vence el 2026-08-31, en 4
días**, así que ese contador va a mostrar números chicos enseguida. Es el fix funcionando,
pero conviene saber que es visible.

**Los 5 con todo vencido ven el panel de hábito.** Antes habrían visto la oferta para
recomprar; ahora no. Correcto: no queremos vender, y no perdieron nada que siguiera vigente.

### El dato que más pesa: la exposición tiene fecha de caducidad

**El último pase activo vence el 2026-09-13 — en 16 días.** A partir de ahí no queda nadie
sosteniendo un pase, y toda la superficie de "un comprador podría leer la pausa como una
revocación" desaparece sin que haya que hacer nada.

⚠️ El uso del reto fue mínimo: **de los 11 con pase activo, 5 nunca registraron un solo
día**, el promedio del grupo es **0,6 días** sobre 21 y el máximo de toda la cohorte activa
es **2 días**.
⛔ **Pero "nunca registraron un día" NO significa "nunca jugaron"** — ver la sección de
arriba: 22 de 24 sí jugaron. El contador es lo que no se movió, no la gente.

⚠️ Casi toda la compra fue reciente: **11 de 17 pases se compraron entre el 3 y el 14 de
agosto**, poco antes de la pausa.

---

## ⛔ El VR verde NO prueba los dos cambios más recientes del hub

`app/dev/learn-hub/fixture.tsx` **no monta el chip del Inbox ni el panel del hábito**. Por
eso las 82 baselines quedaron intactas: no es que no cambió nada, es que la foto no los
mira. Es el follow-up #1 del handoff anterior, todavía abierto.

Verificado entonces por **aserción de DOM** contra la app real (modo `learn`, puerto 3002,
env del VR pineada):

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

⚠️ **El chip ausente es la expectativa correcta.** `inbox-chip.tsx` hace
`if (!address) return null`: un visitante desconectado no tiene inbox. Su caso montado lo
cubren los unit tests. Afirmar "presente" ahí habría sido una prueba que sólo podía pasar
por accidente.

---

## Qué entró hoy

| Cambio | Commit |
| --- | --- |
| `/pricing`: etiqueta "Most flexible" en la card destacada | `d3c1633` |
| El ribbon deja de mostrar un filo pálido, y más compacto | `bf67b47` |
| El carrusel del landing dejaba de cotizar el pase pausado | `311fa37` |
| `/pricing` dejaba cuatro imágenes fuera de todo catálogo | `5973057` |
| Una venta filtrada con la venta pausada ahora se ve | `eb9d0de` |
| El carrusel obedece la MISMA perilla que la venta real | `5393183` |
| `ops:health` mira el par de guardado de score | `9964ea7` |
| La card deja de saltarle a los 11 que pagaron | `c6a1dae` |
| Audit: qué hicieron los 24 compradores | `8e0466d` |
| **Audit: qué hace realmente la gente en PLAY** | `d431a0d` |

### La revisión adversarial y lo que salió de ella

`docs/reviews/2026-08-27-adversarial-review-pre-push.md` — 11 hallazgos. Se cerraron los dos
que importaban:

**#1 — la pausa es sólo de UI.** ⚠️ **Se decidió NO bloquear en el servidor, y es correcto.**
El jugador paga **on-chain antes** de que `verify-payment` corra: rechazar ahí le sacaría la
plata y no le daría nada. El rechazo sólo sirve *antes* del pago, y esa compuerta ya existe
(la sheet se auto-esconde). Lo que faltaba era **enterarse**: ahora un pase otorgado con la
venta pausada emite `season_pass_sold_while_sales_paused`.
⛔ Nunca convertirlo en un `return err(...)` sin mover antes el rechazo delante del pago.

**#2 — despausar habría quedado a medias.** El landing tenía una constante hardcodeada; ahora
lee `NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED`, la misma que la app.
⚠️ **Son dos proyectos de Vercel: la variable va en los DOS.**
⚠️ `NEXT_PUBLIC_` se inlinea en build → **hace falta redeploy**, no alcanza con el setting.
Verificado contra un server real de Next en las dos direcciones.
⚠️ Falta declarar la clave en `apps/landing/.env.template` (no pude: un hook bloquea leer
archivos `.env`).

**#6 — nada medía el evento nuevo.** `ops:health` ahora imprime el par:
```
guardado de score 24h: fallo=3 · aplazado=0 (0% del total es aplazado, no fallo)
```
Ese es el **antes** correcto, medido en producción hoy. Al desplegar, `aplazado` debería
absorber el grueso. ⚠️ Leer **los dos números**: una caída de `fallo` sola es ambigua.

Quedan **8 hallazgos menores**, ninguno bloqueante. Los más útiles: el `.limit(50)` del
inbox hace que `unreadCount` pueda subcontar, y `formatUsd6` trunca en vez de redondear.

---

## Qué NO entró — el siguiente batch, sin cambios

| # | Pendiente | Por qué importa |
| --- | --- | --- |
| **4** | **Instrumentar la compra de Peones** | **El de mayor valor.** Sin esto no hay latencia, conversión ni tasa de fallo |
| **6** | **Exponer la compra** | El shop muestra `item_id 6` (PRO); la micro-compra que sí pueden pagar no tiene vitrina |
| 5 | Metadata económica en `peones_ledger` | Guarda Peones, no precio ni token |
| 7 | Funnel de minijuegos | 181 personas abrieron y no jugaron (24 % open→start) |
| 8 | Reposicionar Learn | Parcial: pausar el pase ya sacó el hábito del centro |

## Follow-ups abiertos (no bloquean)

1. ⚠️ **El fixture del VR bypasea la lógica real** y dos baselines tienen nombres que
   mienten (`vr18-learn-hub-pro — unbounded window`). Debería construirse con
   `buildChallengeProgressView`.
2. ⛔ **Confirmar si el Focus Day debería contar en PLAY** — la pregunta que deja el audit de
   comportamiento. Requiere cruzar `account_ref` con `analytics_events` para pasar de
   hipótesis a medición, y es una **decisión de producto**, no un bug: el código lo restringe
   a LEARN a propósito. Si el pase vuelve, hay que responderla antes.
3. `/es/es/arena` — el link de duelo duplica el locale. Reproducible, diferido.
4. `treasury_payment_intents`: 24 filas de julio con el canary OFF.
5. `learn.chesscito.com` en 12,7 s en frío contra 3,3 s de `play`.

## Del founder

- **Push de los 45 commits.** ⚠️ `chesscito-landing` despliega **producción** al pushear a
  `main`, sin preview.
- **Transferencia manual de $0.33** a la wallet en
  `private/2026-08-25-challenge-reward-ledger.md`.
- **Declarar `NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED`** en `apps/landing/.env.template`.

---

## ⛔ DÓNDE RETOMAR — la próxima sesión empieza acá

**Decisión del founder al cerrar (2026-08-27): NO se pushea todavía.** La próxima sesión
arranca **con más preguntas sobre los datos**, antes de cualquier push o cambio de código.

**Estado congelado:** 45 commits en `main` local, **árbol limpio**, todo verde. No hay trabajo
a medias, no hay archivos sin commitear, no hay nada que reconstruir.

### Lo que se puede responder sin tocar nada

Las tres auditorías de hoy son read-only y reproducibles. Las consultas usaron
`pnpm ops:query <archivo.sql>` contra producción:

| Documento | Responde |
| --- | --- |
| `docs/audits/2026-08-27-play-behavior-and-retention.md` | qué hace la gente en PLAY, qué se asocia con volver |
| `docs/audits/2026-08-27-what-buyers-actually-did.md` | qué hicieron los 24 compradores |
| `docs/reviews/2026-08-27-adversarial-review-pre-push.md` | los 11 hallazgos del review, 2 cerrados |

⚠️ **`pnpm ops:query` rechaza cualquier `.sql` con un `;` dentro de un comentario.** Parte el
script por `;` antes de quitar comentarios y el primer trozo queda vacío; el error dice
`no statement found`, que no lo sugiere. Costó dos diagnósticos hoy.

### Las preguntas que quedaron abiertas, en orden de cuánto cambian una decisión

1. **¿Por qué el 48% de quienes inician una partida no termina ninguna?** 1.746 personas, la
   mayor fuga de PLAY. ⛔ **No hay instrumentación para responderlo** — no existe evento de
   abandono ni de duración de partida.
2. **¿Por qué jugar exactamente 1 partida predice PEOR retorno que no entrar a la arena?**
   (4,6% vs 8,1%).
3. **¿Qué se hace con los 1.096 que no tienen un solo stablecoin?** Son el 59,6% de quienes
   ven la hoja de PRO. Y la falta de fondos es **plana** entre quienes vuelven y quienes no,
   así que no es lo que los expulsa.
4. **¿Daily o Coach?** Los dos dan ~4× retorno pero alcanzan poblaciones distintas: el top por
   partidas se caracteriza por Coach, el top por días por el daily.
5. **¿Se puede empujar al 88% que toca una sola superficie a tocar la otra?** El 12% que cruza
   retiene 5×.
6. **¿El Focus Day debería contar en PLAY?** Decisión de producto, no bug. Hay que responderla
   antes de que el pase vuelva.

### El bloqueo que impide cerrar varias de esas preguntas

⛔ **No hay puente entre `account_ref` (HMAC de la wallet) y `wallet`.** Sin él es imposible
unir comportamiento con compras: qué hizo alguien antes de pagar, qué hizo después, si comprar
cambia la profundidad de uso. Resolverlo es una decisión (¿se calcula el HMAC en una consulta
puntual con el secreto?, ¿se instrumenta de otra forma?) y **no se tomó**.

---

## Después del push — qué mirar

| Señal | Esperado |
| --- | --- |
| `guardado de score` en `ops:health` | `aplazado` sube y absorbe el volumen de `fallo` |
| `season_pass_sold_while_sales_paused` | **cero**. Si aparece, hay bundles viejos vivos |
| Reportes de pérdida de acceso | **cero** — 11 pases activos siguen intactos |
| Contador de PRO | 5 personas empiezan a ver días; la primera vence el 2026-08-31 |
| **2026-09-13** | vence el último pase: se acaba sola la exposición de la pausa |
