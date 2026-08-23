# Chesscito — Language Brief (ES / EN)

> **Status:** v1.1 — §3 mide en PÍXELES, y §3.5 fija la puntuación.
> **Audience:** product, design, engineering, agents.
> **Companion doc:** `apps/web/src/lib/content/README.md` (technical architecture).

---

## 1. Brand voice

Chesscito habla con un tono:

- **Claro** — sin jerga innecesaria; el jugador entiende qué pasa en su primer scan.
- **Mobile-first** — todo el copy se diseña pensando en 390 px de ancho.
- **Educativo** — los retos son lecciones, no exámenes.
- **Game-like** — celebra logros sin sonar a documento técnico.
- **Cálido** — apoya al jugador, no lo intimida.
- **Visual** — confía en iconos + microcopy corto, no en párrafos.
- **No infantil en exceso** — no usamos diminutivos forzados, emojis decorativos, ni "¡muy bien campeón!".
- **No técnico en exceso** — no exponemos primitivas Web3 en CTAs principales.
- **Web3-light** — la cadena (Celo) es un detalle de fondo, no el héroe del mensaje.

## 2. Core positioning

> *Small plays. Big mental habits.*
> *Pequeñas jugadas. Grandes hábitos mentales.*

Chesscito es un compañero lúdico-cognitivo basado en pre-ajedrez. No es:

- una clase de ajedrez competitivo
- un wallet
- una plataforma DeFi
- una herramienta médica

Es un juego corto, agradable y verificable.

## 3. UI copy length rules

### Botones / acciones primarias

| Tipo | Largo recomendado | Notas |
| --- | --- | --- |
| Botón principal | **1–2 palabras** | Verbo de acción simple |
| Acción crítica | **máx 3 palabras** | Cuando agregar contexto vale la fricción |
| ARIA label | hasta ~60 caracteres | Puede ser más descriptivo |
| Subtítulo de CTA | hasta ~60 caracteres | Bajo el botón, no dentro |

### Reglas duras

- Botones **nunca** contienen frases completas con sujeto + verbo + objeto.
- Botones **nunca** mencionan blockchain / NFT / mint en el label visible.
- El botón expresa el **resultado para el usuario**, no el mecanismo técnico.

### ⛔ La cuenta de palabras NO predice el corte — medí píxeles

**"Choose another piece" y "Pick a piece" son ambas tres palabras. Una se corta y la
otra no.** La regla de arriba razona en palabras y el botón razona en píxeles, así que
una frase puede cumplir la tabla y aun así llegar truncada al jugador. Pasó: el botón
principal del overlay de pieza completa mostró **"Choose another…"** durante meses —
el `…` no es parte del copy, es `text-overflow` comiéndose la última palabra.

**Y el presupuesto no es el ancho del botón.** El corte ocurre un nivel más adentro, en
`.principal-button-label`, que lleva `overflow:hidden` + `text-overflow:ellipsis` +
`white-space:nowrap`. Medir el `<button>` da 168 px y dice `truncated: false` — mentira
tranquilizadora. El label real da **155 px**.

| Contenedor | Presupuesto | Fuente | ≈ caracteres |
| --- | --- | --- | --- |
| `.principal-button-label` (size medium) | **155 px** | 800 16.8px system-ui | **~16** |
| Título `h1` del overlay | 250 px | 900 36px SF Pro Display | ~14 por línea (envuelve) |
| Mensaje de overlay | 256 px | 400 14px SF Pro Display | ~2 líneas |

Medido el 2026-08-23 en 390 px con el fixture real (`/dev/exercises-popups`). **Volvé a
medirlo si cambia el tipo o el padding — no lo copies de acá para siempre.**

> **Cómo medir:** abrí la superficie en `/dev`, y sobre el elemento del texto compará
> `scrollWidth` contra `clientWidth`. Si el primero es mayor, se corta. Medí el elemento
> que TIENE el `overflow:hidden`, no su contenedor.

**Regla dura:** ningún label visible puede depender de `text-overflow` para caber. Si
se corta, el copy está mal — no el contenedor.

## 3.5. Puntuación

Auditado sobre el copy user-facing de `lib/content/*.ts` el 2026-08-23.

| Signo | Regla | Estado medido |
| --- | --- | --- |
| **Em-dash `—`** | ⛔ **Nunca** en copy de jugador. Dos frases cortas, o dos puntos. | **0 usos.** Ya se cumple; la regla es para que siga así. |
| **Ellipsis** | Siempre `…` (U+2026), **nunca** `...`. Solo para estados en curso: "Saving…". | ⚠️ **Las dos formas conviven**: 28 con `…` y 17 con `...`, para los mismos estados. Unificado a `…` el 2026-08-23. |
| **`!`** | Como máximo uno por pantalla, y solo en el momento de logro. | 33 usos, concentrados en títulos de celebración. |
| **`?`** | Solo si el jugador realmente elige. Nunca retórico. | 27 usos. |
| **`;`** | ⛔ Nunca. Si necesitás uno, son dos frases. | 0 en copy. |

> **Por qué gana `…` y no `...`:** es la mayoría existente (28 contra 17), es **un**
> carácter en vez de tres — más angosto, y en 390 px cada píxel de un label cuenta — y
> el kerning lo resuelve la fuente en lugar de tres puntos sueltos. La inconsistencia
> era invisible en review porque los dos se ven casi igual; sólo aparece midiendo.
>
> **Por qué el em-dash está prohibido y no solo desaconsejado:** el brief define la voz
> como *clara*, y en 390 px un em-dash mete una subordinada donde el jugador esperaba
> terminar de leer. Los `—` que hay en el repo viven en comentarios de código y en docs
> como este, que no son copy de jugador — ahí son bienvenidos.

### Reglas blandas

- Si ES queda 50% más largo que EN, considerar un sinónimo más corto en ES.
- Mantener visual length parity entre locales para evitar layout-shift.

## 4. Translation principles

**Rule #1 — Translate by intent, not literally.**

ES copy and EN copy should preserve **intention** and **similar visual length**, not literal wording.

### Cuando EN y ES divergen

- "Save Victory" → "Guardar victoria"
   ✓ Mismo verbo, mismo objeto, longitud parecida.
- "Coming Soon" → "Pronto" (no "Próximamente" si rompe layout)
   ✓ ES más corto está OK cuando la longitud importa.
- "Unlock the full experience" → "Desbloquea la experiencia completa"
   ✓ Más largo en ES pero acepta porque es subcopy, no botón.

### Cuando NO traducir

- Marcas / proper nouns: **Chesscito**, **Celo**, **MiniPay**, **PRO**, **ARENA**.
- Símbolos: ★ · → ♛ ♜ ♞ ♟.
- Códigos técnicos visibles al usuario: `0x1234…abcd`, gas fees (mostrarlos como número crudo).
- Comandos: `gh`, `pnpm`, etc.

### Cuando reordenar

- Si EN dice "{piece} Ascendant" (label primero, sustantivo después), ES puede usar "Ascendente {piece}" o mantener "{piece} Ascendente" — depende del flow visual.
- Las frases ICU permiten reordenar placeholders sin cambiar el código.

## 5. Web3 language rules

Chesscito está construido sobre Celo, pero **no le pide al usuario que aprenda Web3 para jugar**. El lenguaje técnico se reserva para subcopy / docs, jamás para botones.

### Mapeo recomendado

| Concepto técnico | UI principal (ES) | UI principal (EN) |
| --- | --- | --- |
| NFT | Insignia / Trofeo / Coleccionable digital | Badge / Trophy / Digital Collectible |
| Mint | Guardar / Obtener | Save / Claim |
| On-chain | Guardado en Celo / Verificable / Para siempre | Saved on Celo / Verifiable / Saved forever |
| Transaction | Confirmación | Confirmation |
| Smart contract | Sistema sobre Celo | Celo-powered system |
| Gas fee | Costo de red (subcopy únicamente) | Network fee (subcopy únicamente) |
| Wallet | Wallet (consolidado en LATAM/US) | Wallet |
| Approve | Confirmar / Permitir | Confirm / Approve |
| Signature | Firma | Signature |

### Jerarquía de exposición

1. **Nivel 1 — UI principal (botones, headings).** Lenguaje 100% emocional + entendible.
   - "Guardar victoria" / "Save Victory"
   - "Obtener premio" / "Claim Reward"
2. **Nivel 2 — Subcopy / hints / toasts.** Puede mencionar Celo como destino del resultado.
   - "Tu logro quedará guardado en Celo."
   - "Your achievement will be saved on Celo."
3. **Nivel 3 — Docs / advanced / dev surfaces.** Lenguaje Web3 completo permitido.
   - "Esta insignia se representa como un coleccionable digital on-chain."
   - "This badge is represented as an on-chain digital collectible."

### Ejemplos a evitar

| ❌ Mal | ✅ Bien |
| --- | --- |
| "Mint your NFT" | "Save Victory" |
| "Mintear tu NFT" | "Guardar victoria" |
| "Approve smart contract" | "Confirm" |
| "Confirmar smart contract" | "Confirmar" |
| "Sign blockchain transaction" | "Confirm in wallet" |
| "Firma la transacción on-chain" | "Confirma en tu wallet" |
| "Buy your on-chain monthly subscription" | "Unlock PRO" |
| "Compra tu suscripción mensual on-chain" | "Desbloquear PRO" |

## 6. Cognitive wellness language rules

Chesscito puede apoyar el entrenamiento cognitivo lúdico. **No es** una herramienta médica, terapéutica ni preventiva.

### Términos PROHIBIDOS

- "prevents Alzheimer"
- "previene Alzheimer / demencia / deterioro cognitivo"
- "mitigates neurodegenerative diseases"
- "mitiga enfermedades neurodegenerativas"
- "medical treatment" / "tratamiento médico"
- "cura" / "cures"
- "therapy" / "terapia"
- "doctor recommended" / "recomendado por médicos"
- "clinically proven" / "clínicamente probado"

### Términos PREFERIDOS

| Intención | EN | ES |
| --- | --- | --- |
| Soporte al aprendizaje | "supports cognitive training" | "apoya el entrenamiento cognitivo" |
| Habilidades | "encourages focus, memory, patience, and decision-making" | "estimula concentración, memoria, paciencia y toma de decisiones" |
| Aprendizaje activo | "promotes active learning through play" | "promueve el aprendizaje activo mediante el juego" |
| Adultos mayores | "supports active aging contexts" | "puede ser útil en contextos de envejecimiento activo" |

Hard rule: **never imply medical benefit.** Solo lenguaje de soporte / acompañamiento.

Cita obligatoria (ya presente en `COGNITIVE_DISCLAIMER_COPY`):

> "Chesscito is a playful cognitive companion. It does not replace medical diagnosis or treatment."
> "Chesscito es un compañero cognitivo lúdico. No reemplaza diagnóstico ni tratamiento médico."

## 7. Tone by channel

| Canal | Tono | Largo típico |
| --- | --- | --- |
| Botones / CTA | Imperativo corto | 1–2 palabras |
| Toasts | Hecho, no instrucción | "Saved." / "Guardado." |
| Onboarding splash | Cálido + breve | 1 frase |
| Mission hints | Educativo + accionable | 1–2 frases |
| Error overlays | Calmo, no técnico | 1 frase + hint opcional |
| Coach analysis | Conversacional, segunda persona | 2–4 frases |
| Legal / About | Formal pero accesible | Párrafos cortos |
| Share copy | Logro celebrado, ego-friendly | 1 frase |

## 8. Preferred vocabulary table

### Verbos UI (acciones)

| EN | ES | Notas |
| --- | --- | --- |
| Save | Guardar | Acción canónica de persistir progreso |
| Claim | Obtener | Más cálido que "reclamar" |
| Unlock | Desbloquear | OK en botones, evitar "abrir" |
| Continue | Continuar | Genérico avanzar |
| Try Again | Reintentar | Más corto que "intentar de nuevo" |
| Confirm | Confirmar | Genérico tx |
| Cancel | Cancelar | Genérico abort |
| Connect | Conectar | Para wallet |
| Disconnect | Desconectar | Para wallet |
| Practice | Entrenar | Más activo que "practicar" |
| Play | Jugar | Genérico |
| Share | Compartir | Genérico |
| Start | Comenzar / Empezar | Ambos válidos |
| Open | Abrir | Para sheets / menus |
| Close | Cerrar | Genérico |
| Buy | Comprar | OK para shop |
| Pay | Pagar | OK para shop |

### Sustantivos de gameplay

| EN | ES | Notas |
| --- | --- | --- |
| Badge | Insignia | NO "medalla" |
| Trophy | Trofeo | OK |
| Victory | Victoria | OK |
| Shield | Escudo | OK |
| Streak | Racha | OK |
| Move | Movimiento | OK |
| Capture | Captura | OK |
| Mission | Misión | OK |
| Tactic | Táctica | OK |
| Daily | Diario / Diaria | Concordancia ES |
| Champion | Campeón / Campeona | Default masculino por ahora |
| Mastery | Maestría | OK |
| Score | Puntaje | LATAM > "puntuación" |
| Leaderboard | Líderes / Tabla | "Líderes" es más corto |

### Frases recurrentes

| EN | ES |
| --- | --- |
| Coming soon | Pronto |
| Available | Disponible |
| Unavailable | No disponible |
| Loading… | Cargando… |
| Saved | Guardado |
| Locked | Bloqueada / Bloqueado (según género del sustantivo) |

## 9. Do / Don't quick reference

### ✓ Do

- Empieza por el verbo de acción.
- Usa tuteo en ES (vos / usted reservados a copy formal específico — ej. legal).
- Mantén consistencia: si "Guardar" en una pantalla, evitar "Salvar" en otra.
- Reusa keys existentes en `editorial.ts` antes de crear nuevas.
- Pide review nativa ES-MX antes de un flag flip.

### ✗ Don't

- No uses signos de exclamación en cascada ("¡¡¡Genial!!!").
- No uses emojis decorativos en copy editorial (íconos del sistema sí).
- No mezcles inglés y español en un mismo string ("Guardar tu Victory").
- No menciones primitivas Web3 en botones principales.
- No traduzcas marcas: PRO, ARENA, Chesscito, Celo, MiniPay quedan tal cual.
- No hagas claims médicos. Punto.

## 10. Migration & maintenance notes

- **Authoring source** vive en `apps/web/src/lib/content/editorial.ts` (EN). Cambiar copy EN allí.
- **ES overrides** viven en `apps/web/src/lib/content/messages/es.ts`. Spread de EN como fallback.
- **Bundle EN** se compila automáticamente en `messages/en.ts` desde editorial.ts.
- Ver `apps/web/src/lib/content/README.md` para la arquitectura técnica completa.

Cuando edites copy EN existente: revisa si esa key tiene override en `es.ts` y actualiza la versión ES en el mismo PR. No hay sync automático.

Cuando agregues copy EN nuevo: si la key no aparece en es.ts, ES users verán el inglés (fallback). Eso está OK temporalmente; el audit script lo va a flaggear.

## 11. Audit & validation

Ejecuta:

```bash
pnpm content:audit
```

para obtener un reporte de:

1. ES keys huérfanas (no existen en EN).
2. EN keys sin override ES.
3. Strings largos en paths sospechosos de ser botón.
4. Términos Web3 técnicos en copy user-facing.
5. Claims cognitivos/médicos riesgosos.
6. Function helpers en editorial.ts que podrían necesitar mirror ICU.

El script **no bloquea build** — solo reporta. Útil como gate manual antes de flag flip.

---

**Última revisión:** 2026-05-24.
**Mantiene:** Wolfcito (@akawolfcito).
