# Chesscito PRO — Training Academy Strategy

> **Documento rector de producto.** Define la narrativa madre de Chesscito, el rol de PRO dentro de esa narrativa, los límites éticos de la capa cognitiva, y los criterios que cualquier feature, copy o pantalla nueva debe cumplir antes de salir.

- **Fecha**: 2026-05-03
- **Autor**: Producto + Wolfcito (revisión Chesscito Coach + César Litvinov Alarcón pendiente)
- **Estado**: Draft v1 — **aprobado como canon operativo (2026-05-03)** con 4 ajustes validados:
  1. César Litvinov Alarcón — Maestro FIDE confirmado como diferenciador real.
  2. Capa humana = futura, **no** incluida por defecto en PRO Phase 0/0.5. PRO eventualmente da "prioridad o acceso anticipado a cupos de revisión, sesiones guiadas o eventos especiales".
  3. Naming "ELO Chesscito" en UI, con tooltip *"métrica interna de progreso, no rating oficial FIDE"*. En docs técnicos: `pseudo-ELO / internal rating`.
  4. "sin presión, sin tiempo" → **"sin presión agresiva ni mecánicas punitivas"** (streaks suaves, timers opcionales y misiones cortas válidos; FOMO / life systems / pérdida de progreso no).
- **Alcance**: narrativa, pilares, free vs PRO, claims permitidos/prohibidos, roadmap visual por fases, implicaciones por superficie, acceptance criteria, anti-overclaim checklist y canon corto reusable.
- **No es**: spec técnico, plan de implementación, ni cambio de copy. Esos vienen después y se derivan de aquí.

---

## 1. North Star

> **Chesscito es una academia viva de ajedrez y pre-ajedrez diseñada para entrenar la mente desde etapas tempranas mediante retos visuales, juego progresivo y guía experta.**

Frase corta operativa para landing y meta:

> **Pequeñas jugadas. Grandes hábitos mentales.** *(ya en `LANDING_COPY.meta.title`)*

Frase corta operativa para PRO:

> **Tu plan de entrenamiento. Tu forma de mantener Chesscito abierto para todos.** *(ya en `PRO_COPY.tagline`)*

La North Star debe poder leerse sin entender criptomonedas, sin entender NFTs y sin entender Elo. Si una superficie no respeta eso, la superficie pierde.

---

## 2. Qué es Chesscito

Chesscito es **tres cosas a la vez** y debe sentirse así en cada superficie:

1. **Un juego visual** — ejercicios cortos, tablero claro, recompensas visibles, fácil de compartir.
2. **Un programa de entrenamiento ajedrecístico progresivo** — pre-ajedrez → piezas individuales → finales → partida completa → IA que crece contigo.
3. **Un hábito de actividad cognitiva** — diseñado para integrarse a una rutina diaria/semanal de mente activa, sin presión agresiva ni mecánicas punitivas (streaks suaves, timers opcionales y misiones cortas son válidos; FOMO, life systems o pérdida de progreso no).

El producto **no elige uno** de los tres. Los tres conviven y se refuerzan. Cuando un usuario gana en Arena, gana **una victoria visual** (Victory card) **una victoria ajedrecística** (checkmate medido) y **un punto en su rutina cognitiva** (achievement / progreso). Las tres lecturas tienen que estar disponibles desde el primer minuto.

---

## 3. Qué NO es Chesscito

Para evitar drift narrativo y exceso de promesas, dejamos por escrito qué **no** somos:

| NO somos… | …porque |
|---|---|
| Una app médica, terapéutica o clínica | No diagnosticamos, no tratamos, no curamos. Cualquier copy que insinúe lo contrario rompe la regla del proyecto. |
| Un curso reglado de ajedrez con FIDE rating real | Damos entrenamiento progresivo y una métrica interna llamada *ELO Chesscito*. No es rating oficial FIDE y siempre va con tooltip aclaratorio. |
| Una herramienta de productividad / brain training genérica | No vendemos "haz X minutos al día y verás Y". Acompañamos un hábito; no prometemos resultados. |
| Una app cripto / DeFi / inversión | Web3 es **infraestructura silenciosa** (custody, badges, victorias trazables). Nunca el protagonista. |
| Una suscripción "all you can eat" de IA | PRO **no** es "Coach ilimitado por sí mismo". PRO es **una ruta de entrenamiento avanzado y continuo** que incluye Coach sin límite como una pieza del puzzle. |
| Un programa solo para niños o solo para adultos | El target es "etapas tempranas en adelante". Útil para 8 años, útil para 80. Diseñado para que ninguno se sienta excluido. |
| Una promesa de prevenir o retrasar enfermedades neurodegenerativas | **Hard rule.** Ver §8 (Capa cognitiva — límites de claims). |

Si una nueva feature solo se sostiene rompiendo una de estas filas, la feature está mal enmarcada — no la propia tesis.

---

## 4. Los tres pilares narrativos

Toda comunicación, copy, pantalla y CTA de Chesscito puede mapearse a uno de estos tres pilares. Si no se puede mapear, sobra o está mal posicionado.

### Pilar 1 — Juego visual

**Promesa al usuario**: *"Esto se ve bien, se entiende rápido y se siente como un juego."*

| Cómo se ve hoy | Cómo debe escalar |
|---|---|
| Ejercicios pre-ajedrez (rook → queen) | Más piezas + retos diarios visualmente curados |
| Play Hub con misiones, badges, shop | Misiones rotativas + paquetes visuales temáticos |
| Arena vs IA con tablero candy + animaciones | Tableros estacionales, marcos premium, victorias compartibles |
| Victory NFT como tarjeta visual coleccionable | Galería viva, hall of fame con vitrina propia |
| Compartir victorias por enlace OG | Compartir progreso semanal + rituales visuales (rachas) |

**Lenguaje y tono**: alegre, claro, infantil-friendly sin ser infantilizante. Dominan iconos, color, badges, estados (`Nuevo`, `PRO`, `Próximo`). Casi nada de párrafos.

**Anti-patrón**: walls of text explicativos, copy técnico, jerga ajedrecística sin contexto visual.

### Pilar 2 — Entrenamiento ajedrecístico progresivo

**Promesa al usuario**: *"Tu juego mejora porque tu camino tiene sentido."*

Componentes vivos hoy y futuros:

- **Hoy**:
  - Cinco habilidades pre-ajedrez (atención, memoria visual, planificación, patrones, decisiones) ya en landing.
  - Ejercicios por pieza con tres niveles (`APRENDE → EXPLORA → DOMINA`) ya estructurados.
  - Arena vs IA con tres dificultades, juego como blanco/negro, persistencia.
  - Achievements derivados (7 badges, gratis).
  - Quick Review en post-match (gratis, no consume crédito).
  - Coach AI con análisis Full y Quick Review (Coach packs + ilimitado vía PRO).
- **Preparado para activar bajo PRO**:
  - Retos diarios / semanales curados (Lichess-puzzle-style + curaduría humana).
  - Paquetes de posiciones por tema (aperturas, finales clave, motivos tácticos).
  - **Finales fundamentales** — Rey + Torre vs Rey, Rey + Dama vs Rey, oposición.
  - **IA más fuerte** — niveles de dificultad superiores con coaching de error.
  - **ELO Chesscito** — métrica interna de progreso post-Arena. UI: "ELO Chesscito". Tooltip obligatorio: *"Métrica interna de progreso, no rating oficial FIDE."* En docs técnicos: `pseudo-ELO / internal rating`.
  - Misiones largas y campañas estacionales.

**Lenguaje y tono**: claro, accionable, sin pedantería ajedrecística. Términos técnicos solo cuando aportan ("checkmate", "endgame", "pin", "fork") y siempre acompañados visualmente.

**Anti-patrón**: hablar de Elo real, prometer mejora cuantificada en X semanas, copiar tono de plataformas serias de ajedrez competitivo.

### Pilar 3 — Propósito cognitivo

**Promesa al usuario**: *"Mantén tu mente activa con minutos de juego al día — para ti, para tu familia, para tu comunidad."*

Componentes:
- Mantener la mente activa como *hábito*, no como tratamiento.
- Crear rutina mental sin presión agresiva ni mecánicas punitivas. Streaks suaves, timers opcionales y misiones cortas están permitidos; lo que se prohíbe es FOMO, life systems, pérdida de progreso por inactividad, o cualquier mecánica de castigo.
- Iniciar desde edades tempranas (sweet spot pedagógico 8–16, útil después también).
- Usar ajedrez / pre-ajedrez como vehículo lúdico — *no* como objetivo en sí mismo.

**Lenguaje y tono**: cálido, inclusivo, sin urgencia, sin alarmismo. Inspirado en evidencia sobre actividad cognitiva, aprendizaje continuo, reserva cognitiva y hábitos de mente activa — siempre en **modo inspiración**, nunca en modo *claim*.

**Anti-patrón**: lenguaje médico, comparativos clínicos, urgencia ("antes que sea tarde"), copy alarmista, estadísticas sin fuente.

---

## 5. Free vs PRO — la promesa que entrega cada plan

### Principio rector

> **Free debe sentirse decente y valioso, no una demo pobre. PRO debe sentirse como una ruta de entrenamiento avanzado y continuo, no como "lo mismo pero sin límite".**

Cada surface tiene que poder ser disfrutada por un usuario free. Cada surface PRO tiene que tener un *motivo de entrenamiento* — no un *motivo de paywall*.

### Free — qué incluye y por qué basta

Ejes:

- **Ejercicios base** — pre-ajedrez por pieza con badges soulbound al completar.
- **Play Hub inicial** — mission panel con piece-rail, exercise drawer, contextual action slot.
- **Arena base** — tres dificultades vs IA, juego como blanco/negro, persistencia 24h.
- **Quick Review** — análisis ligero post-match sin consumir crédito.
- **Créditos iniciales de Coach** — onboarding pack (Coach packs $0.05 / $0.10 disponibles para extender sin entrar a PRO).
- **Achievements** — 7 logros derivados, soulbound, gratis.
- **Leaderboard básico** — top scores on-chain públicos, vitrina de victorias.
- **Compartir progreso / victorias** — Victory cards + OG image + invite link.
- **Insignias soulbound de progreso** — badges por pieza dominada.

**Test de "decencia"**: si un usuario juega Chesscito free durante 2 semanas y nunca toca PRO, debe sentir que aprendió, jugó, ganó, presumió, y obtuvo recompensas tangibles. Si llega al techo, debe sentir que el techo es el techo de Chesscito gratuito — no un techo artificial impuesto para forzar conversión.

### PRO — qué activo + qué preparado

#### Activo hoy (Phase 0, en 7-day measurement freeze)

- **Coach AI sin límite diario** — bypass del credit ledger Redis (`coach:pro:<wallet>` TTL 30d).
- **Estado visual PRO** — pill/chip persistente, badge en perfil, días restantes en `<GlobalStatusBar />`.
- **Misión narrativa**: *"Tu aporte mantiene Chesscito gratis para nuevas familias, escuelas y jugadores."*

#### Preparado para activar (rampa post-Phase 0)

Estos perks ya están **mencionados** en copy o roadmap pero **no implementados**. Cualquier activación debe preceder al copy, no al revés:

| Perk PRO | Estado | Bloqueador real |
|---|---|---|
| **Retos PRO diarios / semanales** | Sin implementar | Pipeline curaduría + scheduler + UI ranking |
| **Paquetes de posiciones por tema** | Sin implementar | Generador de posiciones + UI catálogo |
| **Finales fundamentales** (R+T vs R, R+D vs R) | Sin implementar | Motor verifica jaque mate + lección guiada |
| **IA avanzada (≥ nivel 4 js-chess-engine o Stockfish-light WASM)** | Sin implementar | Migración engine condicional por PRO |
| **Misiones largas / campañas estacionales** | Sin implementar | Sistema de quests + state machine |
| **ELO Chesscito** (UI) / pseudo-ELO interno (técnico) | Sin implementar | Cálculo post-Arena + storage + tooltip aclaratorio "no es FIDE" |
| **Badges / trofeos / vitrina premium** | Parcial | Achievements PRO + galería diferenciada |
| **Guía experta César / Wolfcito** | Sin implementar | Calendly + cupos + flujo de cobro. **No incluido por defecto en la suscripción PRO.** PRO eventualmente da "prioridad o acceso anticipado a cupos de revisión, sesiones guiadas o eventos especiales", no sesiones gratuitas. |
| **Sesiones cortas o revisión personalizada** | Sin implementar | Mismo flujo que arriba — siempre como compra/booking separado, nunca como entitlement automático del mes PRO. |
| **Asistente AI personalizado con metodología propia** | Investigación | Vector store + RAG sobre lecciones César |
| **Descuentos en Victory cards** | Sin implementar | EIP-712 reconoce `isPro` al firmar |

**Regla**: cada perk listado en `PRO_COPY.perksRoadmap` debe llevar el sufijo `(coming soon)` hasta que el código lo soporte. Cero promesas sin asterisco.

---

## 6. PRO como academia viva

PRO **no** es un plan SaaS estilo "paga y obtén feature". PRO es **el aro alrededor del cual gira la academia** — la membresía a la versión completa de Chesscito como programa de entrenamiento.

### Cómo se cuenta a un usuario nuevo

Tres lecturas que conviven:

1. **Lectura del jugador**: "Es mi plan de entrenamiento mensual con coach al lado y retos avanzados."
2. **Lectura del padre / educador**: "Es la versión seria de Chesscito que apoya el desarrollo cognitivo de mi hijo / estudiantes."
3. **Lectura del aliado**: "Es la forma de mantener Chesscito gratis para más comunidades."

Las tres lecturas son **ciertas simultáneamente**. La PRO sheet debe poder entregar las tres sin mezclarse.

### Estructura de la oferta PRO (modelo a 12 meses)

```
PRO mensual ($1.99/30d)
├── Núcleo activo
│   ├── Coach AI sin límite
│   └── Estado PRO visible (badge + chip)
├── Capa de entrenamiento (rampa Phase 1+)
│   ├── Retos diarios / semanales
│   ├── Paquetes de posiciones
│   ├── Finales fundamentales
│   ├── IA avanzada
│   └── ELO Chesscito (métrica interna, no FIDE)
├── Capa de comunidad / impacto (rampa Phase 2+)
│   ├── Mantiene acceso gratis para nuevos jugadores
│   ├── Misiones colaborativas / campañas
│   └── Vitrina premium (achievements PRO)
└── Capa humana (rampa Phase 2+, NUNCA incluida por defecto en la sub)
    ├── PRO obtiene "prioridad o acceso anticipado a cupos de revisión,
    │   sesiones guiadas o eventos especiales" — no sesiones gratuitas.
    ├── Cupos con César Litvinov Alarcón (Maestro FIDE) — booking separado.
    ├── Revisión personalizada — booking separado.
    └── Eventualmente: asistente AI con metodología propia (RAG sobre lecciones César).
```

### Lo que PRO **no** debe sentirse

- ❌ No es "premium tier" estilo gym — no hay segregación dura por gating excesivo.
- ❌ No es "eliminar publicidad" — Chesscito no tiene publicidad.
- ❌ No es "compra-para-ganar" — no acelera nada que no sea el aprendizaje.
- ❌ No es "membresía exclusiva de élite" — el marketing nunca debe insinuar exclusión.

### Indicador de salud de PRO

PRO está sano cuando:
- Free sigue siendo "decente" (no se erosiona para forzar PRO).
- Cada perk PRO entrega valor de entrenamiento, no solo de ego.
- El missionNote ("apoyas el acceso gratis") aparece **antes** del CTA, no como letra chica.
- Existe al menos una nueva razón para renovar PRO cada 4–6 semanas.

---

## 7. Diferenciador César / Wolfcito

Chesscito **no** es un wrapper sobre lichess + Stockfish + GPT. Tiene **criterio humano real detrás** y eso es el diferenciador no copiable.

- **César Litvinov Alarcón** — Maestro FIDE, formador con +100 estudiantes acompañados, incluyendo alumnos que han competido en torneos nacionales e internacionales. Trayectoria con instituciones (incluida Concentración Deportiva de Pichincha, Ecuador). Aporta **metodología pedagógica** y diseño de curriculum.
- **Wolfcito (Luis Fernando Ushiña)** — Software Developer Architect, +10 años, experiencia ajedrecística personal aproximada 2000–2200 Elo amateur. Lidera producto, tecnología y la visión de plataforma cognitiva escalable.

### Cómo el diferenciador se traduce en producto

| Capa | Cómo se nota el criterio humano |
|---|---|
| **Ejercicios pre-ajedrez** | La progresión por pieza no es algorítmica — sigue una pedagogía probada en aula. |
| **Niveles APRENDE → EXPLORA → DOMINA** | Estructura curricular diseñada por César, no auto-generada. |
| **Retos curados PRO** | Posiciones seleccionadas por César/Wolfcito, no scrape de tactics. |
| **Coach AI** | Prompt + tono editorial reflejan la voz del entrenador (cálido, paciente, no humillante en los errores). |
| **Sesiones humanas (futuro)** | Cupos limitados de César/Wolfcito vía Calendly + Zoom/Google Meet. **No están incluidas en la suscripción PRO.** PRO da, eventualmente, prioridad / acceso anticipado al booking, no asientos gratis. |
| **Asistente AI propio (futuro)** | RAG sobre lecciones de César — *no* es ChatGPT genérico. |

### Cómo se comunica

- En landing: ya está bien (`LANDING_COPY.founders`). Mantener.
- En Arena post-match: una línea sutil ("Coach inspirado en la metodología de César Litvinov Alarcón") al desplegar Coach Analysis.
- En PRO sheet: agregar un microcopy ("Curriculum diseñado por un Maestro FIDE") como tercer perk activo cuando los retos curados PRO arranquen.
- En About: dedicar mini-sección al método.

**Nunca**: vender "clases con un Maestro FIDE" como perk Phase 0 si las sesiones no existen aún. Promesa = código.

---

## 8. Capa cognitiva — límites de claims (HARD RULE)

Esta sección **no es opcional**. Cada copy nuevo debe pasarse por estos filtros antes de ir a producción.

### Lo que SÍ podemos decir

- "Inspirado en evidencia sobre actividad cognitiva, aprendizaje continuo, reserva cognitiva y hábitos de mente activa."
- "Diseñado para activar habilidades clave: atención sostenida, memoria visual, planificación, reconocimiento de patrones, toma de decisiones."
- "Una rutina ligera para mantener la mente activa."
- "Acompañamiento cognitivo lúdico."
- "Pensado para integrarse a una rutina diaria/semanal."

### Lo que NO podemos decir (NUNCA)

| Claim prohibido | Por qué |
|---|---|
| "Previene Alzheimer / demencia / deterioro cognitivo" | Falso médicamente y exposición legal grave. |
| "Trata / cura / mitiga enfermedades neurodegenerativas" | Sin estudio clínico = falso claim médico. |
| "Aumenta tu IQ en X puntos" | Sin estudio = pseudociencia. |
| "Te hace más inteligente" | No medible, no demostrable. |
| "Está respaldado por neurocientíficos" | A menos que existan, a menos que firmen, a menos que lo digan ellos. |
| "Reemplaza terapia / psicólogo / psicopedagogo" | Disclaimer obligatorio en sentido inverso. |
| Comparativos con apps médicas reales | Lumosity ya pagó multas por esto. No queremos repetir. |

### Disclaimer obligatorio

Variantes ya en `editorial.ts`:

```ts
COGNITIVE_DISCLAIMER_COPY = {
  short: "Chesscito is a playful cognitive companion. It does not replace medical diagnosis or treatment.",
  full:  "Chesscito is a playful cognitive companion experience. It does not replace medical diagnosis, treatment, or professional therapy.",
}
```

**Reglas de presencia** (revisadas 2026-05-03):
- `full` en `/` (landing) y en `/about`.
- **NO** se renderiza in-app (play-hub, arena, etc.).
  - **Por qué**: smoke a 390px mostró que el disclaimer en footer comprime el board (file labels a–h se cortan). Más relevante: el mensaje cognitivo no aporta dentro del juego activo, pierde fuerza, y satura una superficie pensada para acción.
  - **Consecuencia**: el disclaimer vive donde sí aporta y donde el lector llega buscando contexto — landing y /about. El app permanece visualmente limpio.
- Cualquier surface in-app que mencione "cognitivo", "atención", "memoria", "decisiones" debe enlazar a `/about` (donde vive el disclaimer `full`) en máximo un scroll desde su entrada.

**Auditoría grep que debe pasar siempre**:
```bash
git grep -i "alzheimer\|demencia\|cura\|previen\|tratamiento" apps/web/src/lib/content/editorial.ts \
  | grep -v "no reemplaza\|does not replace"
# debe retornar 0 líneas
```

---

## 9. Roadmap visual por fases

> Roadmap **narrativo y de superficie**, no técnico. Cada fase agrega una pieza de la academia. Marcamos qué está hecho y qué viene, sin fechas duras hasta que cada Phase entre a planning.

### Phase 0 — Núcleo en producción ✅ (ahora)

- Free: ejercicios + Play Hub + Arena + Quick Review + créditos Coach + achievements + leaderboard + share.
- PRO: Coach ilimitado + estado visual + missionNote.
- Landing: narrativa "pequeñas jugadas, grandes hábitos mentales" locked.
- Disclaimer: presente en landing, pendiente en footers in-app.

**Status**: en 7-day measurement freeze (`project_pro_phase_0`). No tocar superficies PRO mientras dure.

### Phase 0.5 — Coherencia narrativa ⏭ (recomendado siguiente)

Sin nuevas features. Solo ajustar **lo que ya está vivo** para que cuente la historia "academia viva":

- Disclaimer corto en footer de `/play-hub` + `/arena` (componente reusable, ya existe COPY).
- Mini-sección "metodología" en `/about` con 2 párrafos sobre César + Wolfcito.
- Etiquetar visualmente los perks `(coming soon)` con chip "Próximo" en lugar de paréntesis.
- Quitar referencias residuales a "onchain" / "NFT" / "USDC" donde aún aparezcan en flujo emocional (el doc de realineación 2026-04-30 ya identificó casi todos; volver a revisar tras 7-day freeze).
- Renombrar mentalmente `/arena` como **"Arena de práctica"** vs eventual **"Arena PRO"** futura — no requiere cambio de ruta hoy.

**Bloqueado por**: 7-day freeze de Phase 0.

### Phase 1 — Capa de entrenamiento PRO

Activar la primera tanda de perks PRO de entrenamiento:

- **Retos diarios** — 1 puzzle/día seleccionado, gated por PRO.
- **Paquete de finales fundamentales** — R+T vs R, R+D vs R, oposición básica. Gated por PRO.
- **IA nivel 4 / 5** (engine eval) — nuevas dificultades expert+ gated por PRO.
- **ELO Chesscito** v0 — cálculo simple post-Arena, visible en perfil. UI: "ELO Chesscito". Tooltip: *"Métrica interna de progreso, no rating oficial FIDE."*

**Cambio de copy**: PRO empieza a contarse como "ruta de entrenamiento" en lugar de "Coach + apoyo". Ya el copy actual está preparado.

### Phase 2 — Capa humana + comunidad

- Cupos cortos con César/Wolfcito (Calendly), gated por cupos, **no incluidos en PRO**. PRO obtiene prioridad / acceso anticipado al booking.
- Revisión personalizada de partida seleccionada — booking separado, no entitlement automático del mes PRO.
- Misiones colaborativas / campañas estacionales.
- Vitrina premium (achievements PRO).
- Asistente AI con metodología propia (RAG).

### Phase 3 — Distribución y aliados

- Tier Familia (waitlist hoy).
- Tier Educadores y Aliados (outbound hoy).
- Sponsor-a-player / Sponsor-a-school.
- Distribución prize pool v2 (mecánica torneo).

---

## 10. Implicaciones para landing (`/`)

El landing ya está locked en v0.5 (`LANDING_COPY`). Recomendaciones de **revisión narrativa**, no edición:

| Sección | Estado actual | Recomendación |
|---|---|---|
| Hero (`hero`) | "Pequeñas jugadas. Grandes hábitos mentales." | Mantener. Ya entrega Pilar 3 + 1. |
| Problem (`problem`) | "La mente también necesita rutina." | Mantener. Ya entrega Pilar 3. |
| Solution (`solution`) | "Ajedrez antes del ajedrez." | Mantener. Pilar 1 + 2. |
| HowItWorks (`howItWorks`) | Cinco pasos APRENDE → JUEGA. | Mantener. Pilar 2. |
| Capabilities (`capabilities`) | Cinco habilidades. | Mantener + verificar disclaimer adyacente. |
| Audiences (`audiences`) | Niños / Familias / Educadores. | Mantener. |
| **Plans** (`plans`) | Cuatro tiers: Gratuito / PRO / Familia (próx) / Educadores. | **Revisar PRO**: añadir explícitamente "academia viva" en `tagline`/`bullets` si Phase 1 arranca. Hoy ya está alineado para Phase 0. |
| Impact (`impact`) | Trazabilidad / Escala / Comunidad. | Mantener. |
| **Founders** (`founders`) | Wolfcito + César + Den Labs. | Mantener. Considerar agregar línea "+100 estudiantes + torneos nacionales/internacionales" al `lead` (ya está). |
| FinalCta (`finalCta`) | "¿Listo para tu primera jugada?" | Mantener. |

**Riesgo a vigilar**: que en futuras iteraciones se agregue una sección "ciencia detrás" sin estudios reales. **No agregar sección científica hasta tener publicaciones concretas para citar.**

---

## 11. Implicaciones para app

> **Principio operativo**: muy visual, poco copy. Cards, chips, badges, estados, progreso, candados, trofeos, **`New` / `PRO` / `Soon`** (in-app EN); en landing ES los equivalentes son `Nuevo` / `PRO` / `Próximo`. La etiqueta concreta vive en `editorial.ts` (`PRO_COPY.comingSoonLabel`) para que un futuro sprint de traducción flippee el render en un solo punto.

### `/play-hub`

- **Mission panel** ya cuenta Pilar 1 + 2. Mantener.
- **PRO chip** — ya entrega estado. Cuando Phase 1 arranque, considerar mostrar "X retos PRO disponibles" como badge dinámico.
- **Shop sheet** — Founder Badge + Retry Shield. Mantener. Cuando Coach Packs salgan del flag, agregar Coach Pack tile como microcompra de prueba.
- **Footer**: **sin disclaimer cognitivo** (decisión revisada 2026-05-03 tras smoke a 390px — el board se cortaba y el mensaje no aporta en superficie de juego activo). El disclaimer vive en landing + /about.

### `/arena`

- **Entry panel** + **DifficultySelector** — entregan Pilar 1 + 2. Cuando Phase 1 active IA avanzada, agregar nivel "Expert (PRO)" con candado visual.
- **End state** — Victory celebration → claim → share. Mantener. El copy ya está limpio post-realineación.
- **Coach Analysis (post-match)** — agregar línea atribución metodológica ("Coach guiado por la metodología de César Litvinov Alarcón") al desplegar el panel Coach.
- **Footer**: **sin disclaimer cognitivo** (misma decisión que play-hub). Quien necesite contexto cognitivo llega vía /about.

### `/trophies`

- Mantener Hall of Fame + Achievements + MyVictories.
- Cuando Phase 2 active achievements PRO, separar visualmente "Achievements" → "Achievements" + "Achievements PRO" con candado para free.

### `/leaderboard`

- Mantener. Cuando ELO Chesscito arranque (Phase 1), agregar columna "ELO Chesscito" diferenciada con tooltip "Métrica interna, no rating oficial FIDE".

### `/about`

- Agregar mini-sección "Metodología" con foto/tag de César + Wolfcito y la frase canónica del diferenciador (Phase 0.5).
- Disclaimer `full` debe estar al pie.

### Coach surfaces (oculto tras `NEXT_PUBLIC_ENABLE_COACH`)

- Cuando salga del flag, el welcome de Coach debe contar Pilar 2 ("acompaña tu entrenamiento") más que Pilar 1 ("explica tu partida").
- Paywall de Coach debe ofrecer claramente dos rutas: pack one-shot (Pilar 1, prueba) vs PRO (Pilar 2, ruta).

### Componente nuevo (Phase 1+, no ahora)

- `<TrainingPlanCard />` — visual claro de "tu semana de entrenamiento" para PRO. No implementar hasta que retos diarios existan. Es el contenedor visual de "academia viva".

### Lenguaje visual mínimo

Para el spec ejecutable de las primitivas visuales que sostienen esta narrativa (CognitiveDisclaimer, AboutMethodology, ComingSoonChip futuro, kicker Training Pass, status badges, locked-state pattern, anti-patrones), ver:

> **`docs/product/visual-language-minimum-2026-05-03.md`** (Phase 0.5 C5).

---

## 12. Implicaciones para copy

Reglas duras para cualquier nuevo string en `editorial.ts`:

1. **Idioma** — UI in-app permanece EN (Phase 0). Landing ES locked. Traducción dedicada = sprint propio.
2. **Editorial** — todos los strings van por `editorial.ts`. Cero copy inline (regla del proyecto).
3. **Sin promesas sin código** — cualquier perk PRO no implementado lleva `(coming soon)`.
4. **Sin jerga cripto en flujo emocional** — "onchain", "mint", "wallet", "USDC" solo en legal/about/terms. En victory claim, shop, paywall: "guarda", "stablecoin", "tu tarjeta", "tu badge".
5. **Sin claims médicos** — pasa por filtro §8 antes de merge.
6. **Sin urgencia falsa** — nada de "antes de que sea tarde", "tu mente lo necesita ya", countdown timers de FOMO.
7. **Sin tono pedante de ajedrez competitivo** — Chesscito no es chess.com elite.
8. **Sin pretender ser nivel masters** — somos academia *viva*, no academia *seria-ICCF*. Tonal: cálido, claro, paciente.
9. **Cada PRO bullet entrega un beneficio de entrenamiento**, no una característica técnica. ❌ "Bypass del credit ledger" ✅ "AI Coach con análisis sin límite diario".
10. **Mission note antes del CTA** en cualquier sheet PRO.

### Canon de palabras ✅ vs ❌

| ✅ Usar | ❌ Evitar |
|---|---|
| Entrenamiento | Suscripción premium |
| Práctica | Sesión de minado |
| Guía / Coach / Acompañamiento | Mentor élite |
| Hábito mental | Brain training |
| Mente activa | Cerebro fitness |
| Ruta de entrenamiento | Pase ilimitado |
| Inspirado en evidencia | Comprobado científicamente |
| Bienestar cognitivo lúdico | Wellness médico |
| Guarda tu victoria | Mintea tu NFT |
| Apoyas el acceso gratuito | Donas a la causa |
| Comunidad | Ecosistema |
| ELO Chesscito (con tooltip aclaratorio) | ELO real / Rating FIDE / Rating oficial |
| Maestro FIDE (cuando aplique) | Gran Maestro / GM (no aplica) |

---

## 13. Acceptance criteria para futuras features

Cualquier nueva feature, surface, o cambio de copy debe pasar **todos** estos checks antes de merge:

1. ✅ Mapea claramente a uno (o más) de los tres pilares §4.
2. ✅ Respeta qué Chesscito **no es** §3.
3. ✅ Si el feature toca PRO, separa explícito "activo hoy" vs "preparado" §5.
4. ✅ Si el feature menciona cognición, pasa el filtro §8 (claims permitidos vs prohibidos).
5. ✅ Si el feature toca el lenguaje, no introduce ninguna palabra de la columna ❌ del canon §12.
6. ✅ Free no se erosiona — el feature no degrada el plan free para forzar conversión.
7. ✅ Si el feature menciona la metodología humana, atribuye correctamente a César/Wolfcito y no inventa credenciales §7.
8. ✅ Cualquier promesa nueva está respaldada por código merged (no roadmap copy sin (coming soon)).
9. ✅ Disclaimer accesible en máximo 1 scroll desde cualquier surface que mencione cognición.
10. ✅ Test mental: un padre/madre, un educador y un jugador casual entienden el feature sin Google y sin abrir el whitepaper de Celo.

---

## 14. Checklist anti-overclaim (revisar antes de cada release)

Pre-flight automatizable y manual:

```bash
# 1. Sin claims médicos prohibidos
git grep -iE "alzheimer|demencia|previene|cura\b|trata\b" apps/web/src/lib/content/editorial.ts \
  | grep -v "no reemplaza\|does not replace"
# Esperado: 0 líneas

# 2. Sin "unlimited" como gancho principal de PRO
git grep -i "unlimited" apps/web/src/lib/content/editorial.ts | grep -i pro
# Esperado: 0 (mover a "no daily limit" o equivalente)

# 3. Sin "onchain" en flujo emocional
git grep -i "onchain\|on-chain" apps/web/src/lib/content/editorial.ts \
  | grep -iE "victory|claim|share|success"
# Esperado: 0

# 4. Sin "NFT" / "mint" en victory claim
git grep -iE "nft|mint" apps/web/src/lib/content/editorial.ts | grep -i "VICTORY_CLAIM"
# Esperado: 0

# 5. Disclaimer presente
git grep "COGNITIVE_DISCLAIMER_COPY" apps/web/src/components apps/web/src/app
# Esperado: ≥ 4 referencias (landing, about, play-hub footer, arena footer)

# 6. Cero promesas sin (coming soon) en perksRoadmap
node -e "const c=require('./apps/web/src/lib/content/editorial.ts'); console.log(c.PRO_COPY.perksRoadmap.every(p=>p.includes('coming soon')))"
# Esperado: true
```

**Manual**:
- [ ] PRO sheet leída por una persona no-cripto comprende qué obtiene y por qué pagar.
- [ ] Landing leída por un padre/madre comprende qué es Chesscito y para qué le serviría a su hijo.
- [ ] Coach paywall leído por alguien no-ajedrecista comprende qué obtiene.
- [ ] Disclaimer cognitivo aparece visible al pie de play-hub y arena.
- [ ] Cualquier nueva mención de "cognitivo" / "mental" / "atención" tiene disclaimer accesible en 1 scroll.

---

## 15. Canon corto para futuras sesiones de IA

Pegar este bloque como contexto en cualquier sesión nueva (Claude, Cursor, ChatGPT, etc.) cuando se trabaje sobre Chesscito:

```
Chesscito = academia viva de ajedrez y pre-ajedrez para entrenar la mente
desde etapas tempranas mediante retos visuales, juego progresivo y guía
experta humana real (Maestro FIDE César Litvinov Alarcón + Wolfcito).

Tres pilares:
1) Juego visual (ejercicios cortos, Play Hub, Arena, recompensas
   compartibles).
2) Entrenamiento ajedrecístico progresivo (pre-ajedrez → piezas →
   finales → IA fuerte → Coach AI → ELO Chesscito (métrica interna, no FIDE)).
3) Propósito cognitivo (mantener la mente activa como hábito, sin
   reemplazar tratamiento médico).

Free debe sentirse decente y completo.
PRO ($1.99/mes) es la ruta de entrenamiento avanzado y continuo —
NO un "premium ilimitado". Hoy entrega Coach AI sin límite diario +
estado visual + apoyo a acceso gratuito. Resto de perks lleva
(coming soon) hasta que el código exista.

Capa humana NO incluida por defecto en PRO. PRO eventualmente da
"prioridad o acceso anticipado a cupos de revisión, sesiones guiadas
o eventos especiales". Cupos con César/Wolfcito siempre son booking
separado, nunca entitlement automático del mes PRO.

ELO Chesscito = métrica interna de progreso post-Arena. UI literal:
"ELO Chesscito". Tooltip obligatorio: "métrica interna de progreso,
no rating oficial FIDE". Docs técnicos: pseudo-ELO / internal rating.

Diferenciador no copiable: criterio humano real (César Litvinov
Alarcón Maestro FIDE + Wolfcito ~2000-2200 amateur). Metodología de
aula con +100 estudiantes y torneos nacionales/internacionales.

Capa cognitiva HARD RULE: inspirado en evidencia sobre actividad
cognitiva, reserva cognitiva y hábitos de mente activa. JAMÁS afirmar
que previene/cura/trata enfermedades neurodegenerativas. Disclaimer
"no reemplaza tratamiento médico" siempre accesible.

Web3 = infraestructura silenciosa. Nunca protagonista.
"Onchain", "mint", "NFT", "USDC" no aparecen en flujo emocional —
solo en legal/about/terms.

UX: muy visual, poco copy. Cards, chips, badges, estados, progreso,
candados, trofeos. Estados in-app (EN): "New", "PRO", "Soon".
Estados landing (ES): "Nuevo", "PRO", "Próximo". El término "Próximo"
en este canon describe el concepto; la etiqueta render in-app es
"Soon" hasta el sprint de traducción. Sin presión agresiva ni
mecánicas punitivas (streaks suaves, timers opcionales y misiones
cortas válidos; FOMO / life systems / pérdida de progreso no).

Idioma: UI in-app EN (Phase 0). Landing ES locked. Todo copy via
apps/web/src/lib/content/editorial.ts (single source of truth).

Antes de proponer cambios: leer
docs/product/chesscito-pro-training-academy-strategy-2026-05-03.md
```

---

## 16. Open questions (pendientes de validación humana)

Para revisión con Wolfcito + César antes de bajar este doc a planning:

1. ~~**Pseudo-ELO Chesscito** — ¿lo posicionamos como métrica explícita ("Chesscito ELO") o como "Nivel Chesscito" (sin connotación competitiva)?~~ **RESUELTO 2026-05-03**: UI usa **"ELO Chesscito"** con tooltip aclaratorio *"métrica interna de progreso, no rating oficial FIDE"*. Docs técnicos: `pseudo-ELO / internal rating`.
2. ~~**Sesiones humanas** — ¿se modelan como perk PRO con prioridad o como compra independiente con descuento PRO?~~ **RESUELTO 2026-05-03**: capa humana **no incluida por defecto** en la suscripción PRO. PRO obtiene, eventualmente, "prioridad o acceso anticipado a cupos de revisión, sesiones guiadas o eventos especiales". Booking siempre separado.
3. **Familia tier** — ¿colapsa con PRO multi-asiento o se mantiene como producto separado con precio propio?
4. **Asistente AI propio (RAG sobre lecciones César)** — ¿se construye en Phase 2 o se difiere hasta validar Phase 1 de retos curados?
5. **Atribución metodológica visible en Coach** — ¿microcopy ya en Phase 0.5 o esperar hasta que existan retos curados Phase 1?
6. **Disclaimer en footer in-app** — ¿variant `short` siempre visible o solo cuando el usuario haya estado X minutos en la sesión?
7. **Tono del PRO en Phase 1** — ¿migramos a "Tu plan de entrenamiento personalizado" o seguimos con "Tu plan de entrenamiento + apoyas el acceso gratuito"?
8. **"Academia" como palabra** — ¿lo usamos visiblemente en UI/landing o solo en estrategia interna? (riesgo: suena formal/escolar; ventaja: ancla la posición).

---

## 17. Referencias

Documentos consultados al construir este doc:

- `docs/business/business-model-2026-04-28.md` — modelo comercial PRO + Coach.
- `docs/business/monetization-map-2026-04-30.md` — vectores de ingreso vivos.
- `docs/business/narrative-realignment-2026-04-30.md` — auditoría de narrativa app vs landing.
- `docs/business/web3-terminology-softening-audit-2026-05-01.md` — softening cripto en surfaces.
- `apps/web/src/lib/content/editorial.ts` — single source of truth de copy (PRO_COPY, COACH_COPY, ARENA_COPY, LANDING_COPY, COGNITIVE_DISCLAIMER_COPY, etc.).
- `docs/superpowers/specs/2026-04-25-landing-narrative-v0.5.md` — landing locked.
- `docs/superpowers/plans/2026-04-29-pro-phase-0.md` — Phase 0 PRO.
- `~/.claude/projects/.../memory/project_pro_phase_0.md` — estado operativo Phase 0.
- `~/.claude/projects/.../memory/project_chesscito_coach.md` — estado Coach (gated).

---

**Fin del documento.** Próximo paso: revisar §16 con Wolfcito, alinear, y bajar Phase 0.5 a `docs/superpowers/plans/`.
