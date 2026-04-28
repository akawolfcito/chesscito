# Chesscito — Pitch Video Script (Opción C: Hybrid)

**Fecha:** 2026-04-27
**Estado:** spec — pre-greenlight
**Autores:** Wolfcito (Luis Fernando Ushiña) + sesión con red-team adversarial
**Red-team report:** [`docs/reviews/pitch-redteam-2026-04-27.md`](../../reviews/pitch-redteam-2026-04-27.md)

---

## 1. Goal & Scope

Producir dos cortes de video pitch (Remotion, vertical 1080×1920, 30fps, español) que comuniquen la propuesta de Chesscito sin caer en jerga cripto, performatividad neuro, ni overclaim cognitivo.

- **A-Cut · Mainstream** (~55s) — corte principal para redes sociales + MiniPay Discover. Audiencia: adulto LATAM 30-55 con hijos en casa, mente ocupada, 10 minutos disponibles. Frame: bienestar lúdico + categoría propia "pre-ajedrez".
- **B-Cut · Caregivers/Care-Centers** (~80s) — corte alterno B2B2C. Audiencia: cuidadores familiares, educadores especiales, terapeutas ocupacionales, centros de día. Frame: rutina de estimulación cognitiva con respaldo académico explícito.

Ambos cortes comparten escenas-base; el B-Cut extiende con bloque académico y disclaimer reforzado.

---

## 2. Decisiones narrativas locked

| # | Decisión | Justificación (red-team P0/P1) |
|---|---|---|
| D1 | Frame categórico: **"Pre-ajedrez. Antes de las reglas, antes del reloj."** | Plantar bandera en terreno no ocupado por Chess.com / Lichess / Duolingo |
| D2 | ICP nombrado en escena 2 | "Para todos = para nadie" (P0 GTM) |
| D3 | MiniPay reframado como **beneficio zero-install**, no branding | Convertir crypto-mention en utilidad funcional (P0 GTM) |
| D4 | César Litvinov Alarcón es **ancla narrativa con voz en off**, no crédito en pantalla | Maestro FIDE = credencial pedagógica más fuerte del proyecto (P1 Impact) |
| D5 | Escena 7 "Victory NFT" reframada a **soberanía de progreso** | Eliminar feature dressing + sospecha NFT-bait (P0 GTM) |
| D6 | "Show don't list": 3 capacidades visibles vs 5 listadas | Evitar trampa Lumosity (P1 GTM, riesgo regulatorio) |
| D7 | Disclaimer del A-Cut va a **texto persistente pequeño** (esquina inferior, esc 3-7), no escena dedicada | Disclaimer dedicado activa la sospecha que pretende neutralizar (P1 Impact) |
| D8 | El B-Cut sí mantiene escena disclaimer reforzada explícita + bloque académico | Si afirmamos beneficio cognitivo en contexto clínico, el rigor es no negociable |
| D9 | CTA bifurcado: in-MiniPay vs social | Funnel actual ambiguo (P1 GTM) |
| D10 | Glosario crypto-light: NFT→trofeo digital, onchain→verificable, wallet→cuenta MiniPay, token→credencial | Mantener Celo + MiniPay con tono cálido y no-técnico |

---

## 3. A-Cut · Mainstream (~55s)

| # | Escena | Dur | Texto principal | Sub-texto | Visual | VO/Audio |
|---|---|---|---|---|---|---|
| 1 | `PitchHook` | 4s | **Entrena tu mente jugando.** | Pre-ajedrez. Antes de las reglas, antes del reloj. | Logo Chesscito + splash | música ambient suave |
| 2 | `PitchProblem` | 6s | **Para mentes ocupadas que tienen 10 minutos.** | Tu cuerpo tiene rutina. ¿Y tu mente? | Texto animado | — |
| 3 | `PitchCapabilityShow` | 7s | (visual: tablero detecta un patrón en pantalla) **Atención. Memoria. Decisiones.** | Lo que el ajedrez entrena — sin la presión. | **Captura Playwright**: ejercicio Torre con highlights | — |
| 4 | `PitchSolution` | 6s | **Sin descargas. Sin registros.** | Abrís MiniPay y jugás. | **Captura Playwright**: play-hub abriéndose | — |
| 5 | `PitchCoachVO` | 7s | (caption pequeño) *César Litvinov Alarcón · Maestro FIDE · Co-Founder* + sub-caption *+100 estudiantes acompañados* | "Llevo más de 20 años enseñando ajedrez. Esto es lo que ojalá hubiera tenido." | Foto/avatar de César + tablero al fondo | **VO en español de César** (5-6s) |
| 6 | `PitchArena` | 6s | **Cuando estés listo, juega de verdad.** | Una IA que se adapta a ti. | **Captura Playwright**: Arena vs IA | — |
| 7 | `PitchSovereignty` | 5s | **Tu progreso vive contigo.** | No en un servidor que puede cerrar. Verificable en Celo. | **Captura**: end-state con trofeo | — |
| 8 | `PitchTeamMini` | 5s | (3 cards rápidas) Luis Fernando Ushiña · César Litvinov Alarcón · Den Labs | Hecho por humanos que aman el ajedrez. | Cards stagger | — |
| 9 | `PitchCTA` | 5s | **Empezá hoy.** | (in-MiniPay) Buscalo en Discover · *o* (social) Link en bio · gratis en MiniPay | Logo + URL/Discover deeplink | — |

**Total:** 51s + 8 transitions × ~0.5s ≈ **55s**.
**Disclaimer persistente** (texto 10px, esquina inferior, opacidad 60%): "Acompañamiento cognitivo lúdico — no reemplaza tratamiento médico." Visible escenas 3-7.

---

## 4. B-Cut · Caregivers/Care-Centers (~80s)

Mismas escenas 1, 4, 5, 6, 7, 8 del A-Cut. Cambian / agregan:

| # | Escena | Dur | Cambio |
|---|---|---|---|
| 1 | `PitchHookCaregiver` | 5s | Texto principal: **Ajedrez simple para mantener la mente activa.** |
| 2 | `PitchProblemCaregiver` | 7s | **Para muchas personas mayores el reto no es aprender ajedrez competitivo — es tener una actividad clara, repetible y motivante.** |
| 3 | `PitchCapabilityShow` (mismo del A-Cut) | 7s | sin cambio |
| **3.5** | `PitchAcademicBlock` (nueva) | 10s | **"Cibeira et al. (2021), estudio piloto controlado con 22 adultos mayores institucionalizados: 12 semanas de entrenamiento en ajedrez mejoraron atención, velocidad de procesamiento, funciones ejecutivas y calidad de vida."** Caption inferior pequeña: *Geriatric Nursing 42(4): 894–900. Estudio piloto, no aleatorizado. Resultados no generalizables a población general.* |
| 4 | `PitchSolutionCaregiver` | 7s | **Chesscito convierte el ajedrez en pequeñas rutinas que pueden acompañarse en casa, en familia o en centros de día.** Sin descargas — abrís MiniPay y jugás. |
| 5 | `PitchCoachVO` (mismo) | 7s | sin cambio |
| 6 | `PitchArena` (mismo) | 6s | sin cambio |
| 7 | `PitchSovereignty` (mismo) | 5s | sin cambio |
| 8 | `PitchTeamMini` (mismo) | 5s | sin cambio |
| **9** | `PitchDisclaimerCaregiver` (reforzado) | 8s | **"Chesscito no diagnostica, trata, previene ni cura enfermedades neurodegenerativas. Su propósito es educativo y recreativo. Cualquier uso en personas con deterioro cognitivo o necesidades clínicas debe complementarse con la orientación de profesionales de salud."** |
| 10 | `PitchCTACaregiver` | 6s | **Compartilo con quien acompañas.** chesscito.app · gratis en MiniPay |

**Total:** ~78s + transitions ≈ **80-83s**.

---

## 5. Citations — Verified

### Cibeira et al. (2021) — VERIFIED ✅ 2026-04-27

**Cita completa:**
Cibeira, N., Lorenzo-López, L., Maseda, A., Blanco-Fandiño, J., López-López, R., & Millán-Calenti, J. C. (2021). *Effectiveness of a chess-training program for improving cognition, mood, and quality of life in older adults: A pilot study.* **Geriatric Nursing**, 42(4), 894–900. DOI: [10.1016/j.gerinurse.2021.04.026](https://doi.org/10.1016/j.gerinurse.2021.04.026) · PubMed PMID: 34098442.

**Datos confirmados (CrossRef + PubMed):**
- Diseño: pilot study, **no aleatorizado**, controlado, pre/post
- N = 22 adultos mayores españoles (institucionalizados + semi-institucionalizados)
- Intervención: 1h × 2/semana × 12 semanas
- Resultados significativos: atención, velocidad de procesamiento, funciones ejecutivas, calidad de vida
- ⚠️ NO afirma: mejora en "estado cognitivo global" (eliminado del draft) ni en ánimo/depresión (GDS) pese al título
- >50% del N tenía deterioro cognitivo severo por MoCA

**Frase final lockeada para esc 3.5 B-Cut** (33 palabras, fiel al paper):
> *"Cibeira et al. (2021), estudio piloto controlado con 22 adultos mayores institucionalizados: 12 semanas de entrenamiento en ajedrez mejoraron atención, velocidad de procesamiento, funciones ejecutivas y calidad de vida."*

**Caption inferior (limitaciones obligatorias):**
> *Geriatric Nursing 42(4): 894–900. Estudio piloto, no aleatorizado. Resultados no generalizables a población general.*

### JAMA Network Open (2023) — soporte Q&A
Lifestyle enrichment / dementia risk Australian cohort. **No va en pantalla**; queda como backup para preguntas. DOI a localizar si necesario.

### César Litvinov Alarcón — VO ✅
Confirmado: **"más de 20 años"** enseñando ajedrez. Frase lockeada VO esc 5: *"Llevo más de 20 años enseñando ajedrez. Esto es lo que ojalá hubiera tenido."*

### +100 estudiantes — métrica metodológica ✅
Origen pedagógico, no tracción de app. Confirmado por user. Visible como sub-caption en esc 5 (PitchCoachVO) y como lead en `editorial.ts`. **Nunca presentar como "validación clínica" ni como métrica de uso de la app.**

---

## 6. Cambios en `editorial.ts` — APLICADOS ✅ 2026-04-27

`LANDING_COPY.founders` actualizado:

- **Lead** reescrito (saca "web3", incorpora métrica honesta de +100 estudiantes):
  > *"Una combinación poco común: tecnología, IA y un Maestro FIDE con décadas de aula. La metodología detrás de Chesscito viene de más de 100 estudiantes acompañados — incluyendo alumnos que compitieron en torneos nacionales e internacionales."*

- **Card 1** (`name`/`handle`/`title` reordenados para que el nombre real sea protagonista):
  - name: "Luis Fernando Ushiña"
  - handle: "aka Wolfcito"
  - title: "Software Developer Architect · Co-Founder Chesscito"

- **Card 2**:
  - name: "César Litvinov Alarcón"
  - title: "Maestro FIDE · Entrenador · Co-Founder Chesscito"

- **Card 3 (Den Labs)**: sin cambios — su body factualmente describe a Den Labs como laboratorio web2/web3/IA, no es jerga del pitch.

---

## 7. Implementation File List

| Archivo | Acción | Notas |
|---|---|---|
| `apps/web/src/lib/content/editorial.ts` | Edit `LANDING_COPY.founders.cards` | Diff §6 |
| `apps/video/src/lib/pitch-copy.ts` | New | Single source of truth para A-Cut + B-Cut |
| `apps/video/src/scenes/pitch/PitchHook.tsx` | New | A-Cut |
| `apps/video/src/scenes/pitch/PitchHookCaregiver.tsx` | New | B-Cut |
| `apps/video/src/scenes/pitch/PitchProblem.tsx` | New | A-Cut |
| `apps/video/src/scenes/pitch/PitchProblemCaregiver.tsx` | New | B-Cut |
| `apps/video/src/scenes/pitch/PitchCapabilityShow.tsx` | New | shared |
| `apps/video/src/scenes/pitch/PitchAcademicBlock.tsx` | New | B-Cut only |
| `apps/video/src/scenes/pitch/PitchSolution.tsx` | New | A-Cut |
| `apps/video/src/scenes/pitch/PitchSolutionCaregiver.tsx` | New | B-Cut |
| `apps/video/src/scenes/pitch/PitchCoachVO.tsx` | New | shared (placeholder audio) |
| `apps/video/src/scenes/pitch/PitchArena.tsx` | New | shared |
| `apps/video/src/scenes/pitch/PitchSovereignty.tsx` | New | shared |
| `apps/video/src/scenes/pitch/PitchTeamMini.tsx` | New | shared |
| `apps/video/src/scenes/pitch/PitchDisclaimerCaregiver.tsx` | New | B-Cut |
| `apps/video/src/scenes/pitch/PitchCTA.tsx` | New | A-Cut (variantes in-MiniPay/social) |
| `apps/video/src/scenes/pitch/PitchCTACaregiver.tsx` | New | B-Cut |
| `apps/video/src/scenes/pitch/_PersistentDisclaimer.tsx` | New | Overlay 10px para A-Cut |
| `apps/video/src/ChesscitoPitch.tsx` | New | Composition A-Cut |
| `apps/video/src/ChesscitoPitchCaregiver.tsx` | New | Composition B-Cut |
| `apps/video/src/Root.tsx` | Edit | Agregar 2 `Composition` (sin tocar `ChesscitPromo`) |
| `apps/video/scripts/capture-screenshots.ts` | New | Playwright, viewport 390×844, dev :3000 |
| `apps/video/package.json` | Edit | Deps `playwright` + scripts `capture` `render:pitch` `render:caregiver` |

---

## 8. Open questions — TODAS RESUELTAS ✅ 2026-04-27

| # | Pregunta | Respuesta lockeada |
|---|---|---|
| 1 | Diff `editorial.ts` founders | ✅ Aplicado (ver §6) |
| 2 | Lead founders sin "web3" | ✅ Aplicado: nuevo lead con +100 estudiantes |
| 3 | Años de César para VO | ✅ "Más de 20 años" |
| 4 | Cibeira DOI verificada | ✅ DOI 10.1016/j.gerinurse.2021.04.026 confirmado vía CrossRef + PubMed PMID 34098442; frase ajustada para no overclaim (ver §5) |
| 5 | Métrica honesta | ✅ "+100 estudiantes acompañados" como **origen metodológico**, no tracción de app — visible esc 5 sub-caption + landing lead |
| 6 | Playwright capture autorizado | ✅ |
| 7 | Spelling Chesscito | ✅ Confirmado typo del usuario; correcto = "Chesscito" |

---

## 9. Done criteria

- [ ] `editorial.ts` actualizado y type-checks pasan
- [ ] Spec aprobado por el usuario en sesión de greenlight
- [ ] 14 escenas Remotion implementadas (8 shared + 6 variantes)
- [ ] Script Playwright captura ≥4 screenshots reales del producto
- [ ] 2 Compositions registradas en `Root.tsx`
- [ ] `pnpm --filter video studio` arranca y previsualiza ambos cuts sin error
- [ ] `pnpm --filter video render:pitch` genera MP4 funcional
- [ ] Disclaimer persistente legible en pantalla móvil 1080×1920
- [ ] Citation de Cibeira verificada antes del render final
- [ ] PR atómico (un commit por: editorial diff, pitch-copy, A-cut scenes, B-cut scenes, capture script, compositions)

---

*Spec generado tras red-team adversarial. No iniciar código hasta greenlight explícito en las 6 preguntas abiertas.*
