# Auditoría de consistencia de beneficios — copy-only (2026-07-23)

## Fuente canónica (dada por el founder)
- **Season Pass**: 21-Day Challenge · Daily Focus · Special Trainings · new games over time.
- **PRO**: incluye Season Pass · Play Chess · unlimited Coach Review · Training Journal · PRO identity.

Reglas: no prometer Arena/NFT/roadmap; solo beneficios respaldados por entitlements reales;
no tocar layout/backend/entitlements; corregir solo copy inconsistente.

## Superficies auditadas y drift

| Superficie | Estado vs canónico | Acción |
|---|---|---|
| Onboarding slide Season Pass (`landing slide2`) | "Decide better in 21 days" + Focus Passport + "Season Pass, $0.99". Minimalista por diseño ("one idea per screen"). Alineado. | Sin cambio |
| Onboarding slide PRO (`landing slide3`) | "Coach PRO includes the Season Pass" + Saved games + Coach review. Contenido alineado (inclusión de Season Pass ✓). | Sin cambio de contenido; ver naming abajo |
| Challenge Card (`CHALLENGE_CARD_COPY`) | 21-Day Mind Challenge, Focus, etc. Alineado. | Sin cambio |
| Season Pass Sheet (`offer*`) | 21-Day Challenge · Daily Focus habit · Special Trainings · "growing over time". **Alineado** (quedó así en #266). | Sin cambio |
| **PRO Sheet (`PRO_COPY.perksActive`)** | **DRIFT**: no menciona "incluye Season Pass"; tiene un bullet suelto "Special Trainings" que en el nuevo canónico vive **bajo** Season Pass. | **CORREGIR** |
| Paywalls/CTAs (`COACH_COPY.paywallProCta`, `HUB_V2_TRAINING_COPY`, pro chip) | CTAs de acción ("Train with Luz every day"), no listas de beneficios. Sin promesas falsas. | Sin cambio |

## Conflictos reportados (NO corregidos a ciegas)

### ⚠️ 1. "Play Chess" no es un entitlement PRO
- Arena/Play se entra libre: `router.push("/arena")` sin gate; el Mini Arena del hub Learn
  se desbloquea **por progresión** (`miniArenaUnlocked = rook stars >= threshold`), no por PRO/pass.
- El único upsell PRO en la superficie de juego es el **Coach Review** post-partida.
- Listar "Play Chess" como beneficio **exclusivo** de PRO sería una promesa no respaldada por
  entitlement → viola tu propia regla.
- **Resolución tomada:** se reconcilia truthfully — "Play Chess" se pliega dentro de
  "Coach review on **every game you play**" (cubre el concepto sin afirmar exclusividad).
  Si querés listarlo como bullet propio igual (framing "PRO = experiencia completa"), decímelo
  y lo agrego en una línea.

### ⚠️ 2. Nombre del producto inconsistente
- `PRO_COPY.label` = **"Chesscito PRO"**; pero `hubCoachCard.title`, `coachKicker*` y la
  landing slide3 usan **"Coach PRO"**.
- Probablemente intencional en superficies coach (framing por la lente del Coach), pero el
  nuevo canónico posiciona PRO como más que coach (incluye Season Pass + Play).
- **No corregido** en este commit: renombrar el producto tiene blast radius grande y requiere
  tu decisión de nombre canónico ("Chesscito PRO" vs "Coach PRO" vs "PRO"). Reportado para follow-up.

## Corrección aplicada (copy-only, commit pequeño)

`PRO_COPY.perksActive` (EN `editorial.ts` + ES `es.ts`):

| Before | After |
|---|---|
| Luz unlimited. Coach review on every game. | **The full Season Pass, included.** |
| Full Training Journal. Every match kept. | Luz unlimited. Coach review on every game you play. |
| **Special Trainings. New games added over time.** | Full Training Journal. Every match kept. |
| PRO identity on your profile. | PRO identity on your profile. |

- ✅ Lidera con la inclusión de Season Pass (entitlement real: `source:"pro"` concede `training_pass`).
- ✅ Special Trainings deja de ser bullet suelto (ahora vive bajo Season Pass, per canónico).
- ✅ "Play Chess" reconciliado en "every game you play" sin afirmar exclusividad.
- ✅ Coach Review, Training Journal, PRO identity conservados.
- ✅ Sin em-dashes (guard anti-AI-prose). Sin cambios de layout/backend/entitlements.
