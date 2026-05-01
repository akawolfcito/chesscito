# Handoff — Chesscito × MiniPay Business Model Session (2026-05-01)

> Sesión de realineación narrativa + preparación de business model y materiales para reunión con MiniPay.
>
> **Frase ancla:** *Pequeñas jugadas. Grandes hábitos mentales.*
> **Principio del modelo:** *Un modelo donde nadie se queda fuera.*
> **Diferenciador:** *Chesscito no es solo un juego ni una colección de NFTs. Es una plataforma de práctica mental lúdica con acceso abierto y economía sostenible sobre Celo/MiniPay.*

---

## 1. Resumen ejecutivo

Cerramos la **Phase 1 de realineación narrativa** de Chesscito: el app, el landing y los documentos de negocio ahora comunican el mismo posicionamiento.

Chesscito quedó descrito como una experiencia de **práctica mental lúdica basada en juegos pre-ajedrecísticos**, con acceso gratuito como puerta de entrada, **PRO como motor recurrente principal**, microaportes opcionales conectados a práctica/apoyo/logros, y **Celo/MiniPay como infraestructura habilitadora — no como protagonista narrativo**.

Aplicamos un **Web3 Terminology Softening Pass** sobre todas las superficies públicas (app, landing, brief y pitch). El resultado: Web3 sigue presente como infraestructura técnica; los términos NFT/on-chain/mint dejan de ser headline o gancho. Una persona Web2 entiende el producto sin necesitar conocimiento cripto; una persona Web3 entiende que hay assets verificables debajo.

También quedaron preparados los materiales para la reunión con MiniPay: **brief largo** + **pitch deck outline de 8 slides** + **guion de respuestas** + **audit doc** que justifica cada decisión editorial.

---

## 2. Commits realizados (11)

| # | SHA | Cambio |
|---|---|---|
| 1 | `0b6b015` | feat(copy): PRO sheet copy + missionNote |
| 2 | `b05992f` | feat(copy): PRO chip label centralizado |
| 3 | `17eaa03` | feat(copy): victory claim flow sin "onchain" |
| 4 | `9559d87` | feat(copy): public victory page + OG + share text |
| 5 | `c4c5cf9` | feat(copy): shop subtitles humanizados |
| 6 | `6b0aeb2` | feat(copy): coach + shop payment wording |
| 7 | `81e3072` | feat(legal): cognitive disclaimer en play-hub + arena |
| 8 | `1de7df6` | fix(ui): onboarding overlap fix (welcome + briefing) |
| 9 | `2dc4489` | feat(copy): web3 terminology softening (código) |
| 10 | `50d1ba4` | docs(business): web3 softening + audit + brief |
| 11 | `c3350ea` | docs(business): MiniPay pitch deck outline |

**Verificación:** 506/506 unit tests verdes en cada commit · type-check limpio · 18/18 visual snapshots pass.

---

## 3. Documentos estratégicos creados o actualizados

| Archivo | Propósito |
|---|---|
| `docs/business/monetization-map-2026-04-30.md` | Mapa exhaustivo de cada SKU activo, precio, contrato, superficie y oportunidades sin explotar |
| `docs/business/narrative-realignment-2026-04-30.md` | Plan original del realineamiento — auditoría inicial, scope por surface, riesgos, plan de commits |
| `docs/business/chesscito-business-model-minipay-brief.md` | Brief largo de business model — 9 secciones para reunión con MiniPay (resumen, capas, pitch table, revenue streams, Supporter Gallery, equipo, guion, next steps, tono) |
| `docs/business/web3-terminology-softening-audit-2026-05-01.md` | Audit del softening pass — diccionario, triage por archivo (keep/replace/defer), riesgos documentados |
| `docs/business/chesscito-minipay-pitch-deck-outline.md` | Versión corta tipo deck — 8 slides en markdown con título, mensaje, bullets, speaker notes y visuales sugeridos. Listo para validar narrativa antes de maquetación visual |
| `docs/reviews/visual-qa-2026-04-30-realignment.md` | Visual QA del Phase 1 — top 5 issues con severidad y fix suggestions; permitió detectar el overlap del onboarding |

---

## 4. Decisiones estratégicas tomadas

- **PRO es el motor recurrente principal.** $1.99 / 30 días. Cualquier otra fuente de revenue se posiciona alrededor.
- **Free tier no es una demo pobre.** Es producto real: tutoriales, badges, leaderboard, share. La regla de diseño es "nadie se queda fuera por no poder pagar".
- **Microaportes son opcionales y conectados a práctica/apoyo/logros.** Nunca como hype, nunca como reward especulativo.
- **Victory NFT se comunica públicamente como Victory Card.** El término técnico vive en el legal y en el código; en la UI y en el pitch desaparece.
- **Founder Badge se posiciona como apoyo a la misión.** No como coleccionable, no como NFT premium.
- **Blockchain / Celo / MiniPay se comunican como infraestructura habilitadora.** Pagos pequeños + trazabilidad + logros verificables. Nunca como producto en sí mismo.
- **No usar NFT / on-chain / mint como lenguaje principal en superficies públicas.** Excepciones documentadas en el audit doc (legal copy, wallet error states, "Connect Wallet" CTAs).
- **Disclaimers cognitivos siempre visibles dentro del app** (play-hub + arena footer). Sin claims médicos en ninguna superficie.
- **Supporter Gallery queda como siguiente oportunidad estratégica.** Tiers definidos en el brief; sin implementación pero diseñada para ser el puente hacia sponsor-a-player y sponsor-a-school.
- **Pitch a MiniPay se enfoca en microtransacciones con propósito.** Caso de uso visible donde MiniPay puede señalar "para esto sirve".

---

## 5. Estado actual del producto

### ✅ Activo / listo
- Free experience completa (tutoriales por pieza, badges, leaderboard, share).
- Play Hub con HUD, dock y PRO chip realineado.
- Arena vs IA (3 dificultades) con Victory Card claim.
- Founder Badge ($0.10 USD o 1 CELO).
- Retry Shield ($0.025 · 3 usos).
- Victory Cards ($0.005 / $0.01 / $0.02).
- PRO sheet implementado con copy nuevo + missionNote.
- Shop copy realineado (header + subtitles humanos + Coach Pack editorial preparado).
- Public Victory page realineada (sin "earn on-chain", sin wallet cruda).
- Cognitive disclaimer compacto en play-hub y arena.
- Pitch deck outline listo en markdown.

### 🟡 En validación
- PRO end-to-end en MiniPay (env vars Vercel + smoke test productivo pendientes).
- Coach detrás de `NEXT_PUBLIC_ENABLE_COACH` (copy preparado, UI no expuesta).
- Métricas de conversión Free → PRO y Free → microcompra (no instrumentadas todavía).

### ⚪ Roadmap
- Supporter Gallery (tiers diseñados; sin contrato ni UI).
- Sponsor-a-player (modelo legal + dashboard pendiente).
- Sponsor-a-school (B2B, sin contrato comercial).
- Family plan (waitlist).
- Educators / Allies (B2B + grants).
- Prize pool payout v2 (método de contrato no existe; el pool ya acumula on-chain).
- Dashboard de revenue / funnel.
- VictoryNFT discount para PRO (en `perksRoadmap`, sin lógica EIP-712).
- Tournament priority (en `perksRoadmap`, sin torneos).
- Premium achievements (en `perksRoadmap`, sin tier system).

---

## 6. Material listo para MiniPay

Ya existe en el repo (todos los paths bajo `docs/business/`):

- ✅ **Brief largo** — 9 secciones cubriendo resumen, capas, pitch table, revenue streams, Supporter Gallery, equipo, guion de respuestas, next steps y tono.
- ✅ **Pitch deck outline** — 8 slides con título, mensaje, bullets, speaker notes y visuales sugeridos. ~7 min de presentación.
- ✅ **Guion de respuestas** — 9 preguntas frecuentes con respuestas listas (qué es, modelo, por qué MiniPay, por qué blockchain, problema, diferencial, qué está listo, qué pedimos, oportunidad).
- ✅ **Business model table** — 7 capas con estado activo / validación / roadmap.
- ✅ **Revenue streams table** — 9 fuentes con precio real y rol estratégico.
- ✅ **Audit log de Web3 softening** — justificación editorial de cada decisión, útil si MiniPay pregunta "¿por qué eligieron este wording?".

### Ask concreto a MiniPay

1. **Distribución** — visibilidad dentro del ecosistema MiniPay como caso de uso de educación / bienestar / impacto.
2. **Validación de pagos pequeños** en producción con usuarios reales.
3. **Feedback UX mobile** — específicamente sobre el flujo de PRO y microaportes.
4. **Co-marketing** — Chesscito como proof-point de microtransacciones con propósito sobre Celo/MiniPay.
5. **Apoyo para campañas** con familias, escuelas y comunidades aliadas.

### Cierre del pitch

> *Chesscito can show what MiniPay makes possible: small payments, real utility, open access, and visible impact.*

---

## 7. Pendientes antes de reunión MiniPay

| # | Tarea | Estado |
|---|---|---|
| 1 | Validar PRO end-to-end en MiniPay (cuenta real comprando) | ⚪ Pendiente |
| 2 | Verificar env vars de Vercel (PRO Phase 0 deploy) | ⚪ Pendiente |
| 3 | Smoke test productivo del flujo de pago | ⚪ Pendiente |
| 4 | Capturar screenshots reales 390px para Slide 7 (Play Hub, PRO Sheet, Shop Sheet, Victory Card pública, Arena) | ⚪ Pendiente |
| 5 | Ensayar pitch de 7 minutos con cronómetro | ⚪ Pendiente |
| 6 | Preparar demo en vivo de 2 minutos (Free → PRO → Victory Card) | ⚪ Pendiente |
| 7 | Definir si Supporter Gallery aparece en el deck como concepto visual o solo como bullet de roadmap | ⚪ Pendiente |
| 8 | Confirmar con César y Luis qué se puede prometer como activo vs roadmap | ⚪ Pendiente |

---

## 8. Riesgos / cuidado

**No prometer en la reunión:**

- Prevención, tratamiento o mitigación médica de ningún tipo. Disclaimer cognitivo siempre visible.
- Prize pool payout — el método del contrato no existe; sigue siendo v2 roadmap.
- Discounted Victory Cards para PRO — listado en `perksRoadmap` con "(coming soon)" porque la lógica EIP-712 no reconoce PRO todavía.
- Early access a nuevos retos para PRO — no hay feature flag por wallet implementado.
- NFTs como inversión, ROI o asset especulativo. La framing aprobada es "recuerdo verificable" / "Victory Card".
- Coverage de Coach paywall público — sigue detrás de feature flag.

**Cuidado con la presencia de Web3:**

- No ocultar Celo/MiniPay — son parte de la propuesta y nuestro diferencial técnico.
- No hacer que dominen la narrativa — el héroe es el usuario practicando, no la transacción.
- Si surge "¿por qué blockchain?", la respuesta correcta vive en el brief (Sección 7) y el deck (speaker note Slide 6): infraestructura para pagos pequeños, logros verificables y trazabilidad de aportes.

---

## 9. Próximo sprint sugerido

| # | Tarea | Por qué |
|---|---|---|
| 1 | **PRO smoke test real** | Bloquea la afirmación "PRO listo" en la reunión. |
| 2 | **Demo script + screenshots** | Sin esto el deck no se puede presentar visualmente. |
| 3 | **Visual pitch deck final** | Convertir el outline en Figma/Pitch/Keynote. |
| 4 | **Supporter Gallery concept / wireframe** | Convierte una promesa en algo mostrable; refuerza el ask de co-marketing. |
| 5 | **Coach public activation plan** | Decidir cuándo quitar el feature flag y cómo medir conversión. |
| 6 | **Revenue / funnel dashboard** | Sin esto no podemos medir la apuesta de MiniPay ni iterar. |
| 7 | **Incorporar feedback de MiniPay** | Después de la reunión. Probablemente revisar UX mobile, copy en MiniPay, distribución. |

---

## 10. Cierre

Chesscito quedó posicionado como una **experiencia de práctica mental lúdica con acceso abierto y economía sostenible**. Tanto el producto como el lenguaje, los documentos y el pitch comunican lo mismo: práctica · progreso · acceso abierto · sostenibilidad · impacto.

La próxima tarea **no es agregar más features**. Es:

1. Validar que el flujo PRO funciona end-to-end en MiniPay.
2. Preparar la demo de 2 minutos.
3. Convertir el outline markdown en un deck visual.

Con eso, Chesscito entra a la reunión con MiniPay con un producto vivo, una narrativa coherente y un ask concreto.

---

**Sesión cerrada:** 2026-05-01
**Total commits:** 11 (todos en `main`)
**Estado tests:** 506/506 verdes · type-check limpio · 18/18 visual snapshots
**Próximo punto de control:** smoke test PRO + demo + reunión MiniPay
