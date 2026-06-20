# Spec — Focus Passport (Chesscito Lite P1)

**Date:** 2026-06-20
**Status:** SPEC ONLY — no implementation
**Predecessor:** Lite P0 closed (smoke 17/17) — `docs/handoffs/2026-06-20-lite-p0-closure-handoff.md`
**Decision this spec enables:** ¿Focus Passport es un P1 pequeño (reusa datos) o
requiere preparar datos primero?

> **TL;DR decisión:** Un Passport **basado en streak** (hero card + 7 slots que
> se llenan según el streak actual) es **P1 pequeño** y honesto — reusa
> `chesscito:daily-progress` casi tal cual. Un **mini-calendar real** (qué días
> exactos se completaron) **NO es posible hoy** sin agregar un historial de
> fechas → eso es data-prep primero (P1.5). Recomendación: shippear el P1
> streak-based y dejar el calendar exacto para P2.

---

## 1. Tesis de producto

Chesscito Lite ya tiene el loop (Daily Focus jugable + overlay celebratorio).
Falta el **refuerzo de hábito**: una superficie persistente que haga visible la
consistencia y dé una razón para volver mañana. Focus Passport convierte el
streak (que ya existe en datos pero casi no se ve) en el ancla de retorno
diario: "tu constancia de foco, visible". Sin castigo, sin claims médicos —
solo progreso visible.

---

## 2. User flow

1. Abrir MiniPay → Hub Lite → ver **Passport** (hero card con streak + 7 slots).
2. Tap Daily Focus → resolver el reto.
3. Overlay celebratorio (ya existe) → **slot de hoy se marca** + streak sube.
4. Volver mañana: el siguiente slot se llena; si pasó >1 día, el streak
   reinicia (mensaje neutro, no punitivo).
5. Al completar 7 días seguidos → milestone visible (badge/sello) + (futuro)
   gancho con Welcome Package.

---

## 3. Qué cuenta como "focus day" (DECISIÓN)

**P1 = 1 Daily Focus resuelto.** Es lo único que hoy escribe a
`recordDailyCompletion()` → es la fuente de verdad existente, sin instrumentar
nada nuevo.

- ❌ N ejercicios → **no se trackea hoy** (exercises usan `PieceProgress`
  id-keyed, sin marca temporal por-día) → requiere data nueva → P2.
- ❌ 1 laberinto → **no se trackea hoy** como evento diario → P2.

> Mantener P1 = daily-only evita inventar reglas ("¿cuántos ejercicios = un
> día?") y evita instrumentación nueva. Multi-fuente es una expansión P2 con su
> propia decisión.

---

## 4. UI propuesta

**Passport hero card** (clonar patrón `vitrine-hero-band` / cream-amber):

- Streak grande ("🔥 N day streak" / "Start your streak").
- **7 slots** en fila (día 1–7). Slot lleno = sello/llama; vacío = outline.
- Subline honesto: "Current streak" (no "estos 7 días exactos" — ver §11).
- Estado vacío: "Solve today's focus to begin." (sin Arena, sin web3 jargon).

Slots se derivan de `min(streak, 7)` llenos + el de hoy resaltado si
`lastCompletedDate === todayUtc()`. **No** mini-calendar real en P1 (no hay
fechas por-día).

---

## 5. Estados

- **Empty** (streak 0, nunca jugó): 7 slots vacíos + CTA.
- **In-progress hoy pendiente** (streak>0, hoy no resuelto): N slots llenos,
  slot de hoy "pendiente/pulsante", CTA "Keep your streak".
- **Hoy resuelto**: slot de hoy lleno, celebración en overlay.
- **Streak roto** (gap >1 día): vuelve a 1 al próximo solve; copy neutro
  ("Fresh start" — no "perdiste").
- **Milestone 7/7**: estado de logro (sello). Luego se repite (semana 2).
- **Hydration**: SSR/primer render = empty default (igual que slot actual) para
  no parpadear estado falso.

---

## 6. Persistencia recomendada (DECISIÓN)

**Local (localStorage), extendiendo `chesscito:daily-progress`.**

- Cumple restricciones: sin DB, sin contratos, sin pagos, sin env, sin on-chain.
- Reusa `DailyProgress { streak, lastCompletedDate, totalCompleted }` tal cual
  para el P1 streak-based — **cero campos nuevos** para la versión mínima.
- Para mini-calendar real (P2): agregar `completedDates: string[]` (cap ~30) al
  mismo objeto, con migración tolerante (ya hay parser defensivo).
- **No on-chain**: no hay txHash → no se promete on-chain (constraint honrada).
- Limitación conocida: es **por-dispositivo, no por-usuario** (no cross-device).
  Documentarlo; no presentarlo como cuenta global.

---

## 7. Relación con Progress/Trophies

- Passport vive primero en **Hub Lite** (ancla de retorno) y se **refleja** en
  Trophies/Progress (hero band ya muestra YOUR PROGRESS / SESSIONS).
- El milestone 7/7 puede convertirse en el **primer achievement Lite real**
  (hoy `emptyHintLite` promete "complete focus challenges to unlock
  achievements" pero no existe ninguno — Passport lo cumple).
- Resuelve parcialmente el riesgo abierto "0 SESSIONS": `totalCompleted` ya es
  un contador de sesiones de foco real reutilizable.

---

## 8. Relación futura con Welcome Package

- Passport **emite un evento** en milestones (ya existe `emitDailyStreakUpdated`;
  añadir `passport.milestone_reached` análogo).
- Welcome Package (NO implementar aquí) podría **suscribirse** a ese evento para
  otorgar recompensa al primer 7/7. Mantener Passport desacoplado: emite, no
  conoce a WP.

---

## 9. Riesgos

- **Estado falso (P0 de honestidad):** mostrar 7 slots como "días exactos" sin
  tener fechas por-día = mentira visual. Mitigación: en P1 los slots
  representan el **streak count**, copy "current streak", no fechas exactas.
- **UTC vs local timezone:** el módulo usa UTC; un usuario cerca de medianoche
  puede ver el "día" cambiar raro. Aceptable P1; documentar.
- **Pérdida de datos:** localStorage se borra al limpiar el WebView → streak se
  pierde. Sin DB no hay backup. Comunicar suave; no prometer permanencia.
- **Reloj manipulable:** fechas locales se pueden adelantar. Bajo impacto (sin
  recompensa monetaria en Lite). No gamificar con dinero hasta tener servidor.
- **Multi-dispositivo:** no sincroniza. No llamarlo "tu cuenta".
- **Scope creep:** no meter multi-fuente, calendar real, WP, ni recompensas en
  P1.

---

## 10. P0/P1/P2 de implementación futura

- **P1 (pequeño, recomendado ahora):** hero card + 7 slots streak-based en Hub
  Lite; reusa `chesscito:daily-progress`; slot de hoy resaltado; estados §5;
  copy neutro; reflejo en Trophies. Sin campos nuevos. **Implementable como P1
  pequeño.**
- **P1.5 (data-prep, si se quiere calendar real):** agregar `completedDates[]`
  con migración + escribir en `recordDailyCompletion`; entonces mini-calendar
  con fechas exactas.
- **P2:** focus days multi-fuente (exercises/labyrinths) con su propia regla +
  instrumentación; grace day opcional; achievement Lite "7-day focus"; gancho
  Welcome Package.

---

## Respuestas directas a las preguntas del spec

- **¿Qué cuenta como focus day?** P1: 1 Daily Focus resuelto (único trackeado
  hoy). N ejercicios / 1 laberinto → P2 (no hay data).
- **¿Cómo se ven los 7 días?** P1: hero card + 7 slots llenados por streak
  count. Mini-calendar real (fechas) → necesita `completedDates[]` (P1.5).
- **¿Dónde vive?** Principal en Hub; reflejo en Trophies/Progress; refuerzo en
  el Daily solved overlay (ya existe).
- **¿Si falla un día?** No castigo: streak vuelve a 1 al próximo solve (lógica
  actual), copy neutro. Grace day = decisión P2.
- **¿Local/off-chain/on-chain?** **Local** (localStorage), extiende módulo
  existente. No on-chain (sin txHash).
- **¿Qué datos existen hoy?** `DailyProgress { streak, lastCompletedDate,
  totalCompleted }` + eventos de streak + overlay celebratorio.
- **¿Qué falta?** Historial por-día (`completedDates[]`) para calendar exacto;
  marca temporal en exercises/labyrinths para multi-fuente.
- **¿Cómo evitar estado falso?** Slots = streak count (no fechas) en P1; copy
  "current streak"; SSR default-empty; nunca pintar día como hecho sin dato.
- **¿Conexión con Welcome Package?** Passport emite evento de milestone; WP
  (futuro) se suscribe. Desacoplado.
- **¿Grant narrative MiniPay/Celo?** Razón diaria para abrir MiniPay no-
  financiera; retención medible (streak, totalCompleted); hábito visible sin
  pay-to-play ni NFT-first.

---

## Recomendación de cierre

**Focus Passport SÍ puede ser un P1 pequeño** en su forma streak-based
(reutiliza datos existentes, cero backend). El único elemento que exige
data-prep previa es el **mini-calendar de fechas exactas** → posponer a P1.5/P2.
Siguiente paso tras aprobar: escribir el plan de implementación del P1 pequeño
(no implementar aún).
