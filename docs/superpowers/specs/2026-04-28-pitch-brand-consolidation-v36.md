# V3.6 — Pitch Brand-First Consolidation

**Fecha:** 2026-04-28
**Alcance:** A-Cut h01..h09 (B-Cut intacto)
**Regla:** No reinventar el sistema editorial. Refinar y consolidar.

---

## A. Diagnóstico breve

1. **No hay anchor persistente de Chesscito.** El nombre vive solo en h01 (badge), h08 (subtitle "detrás de Chesscito"), h09 (URL). Las demás escenas son "anonymous editorial". Falla la regla del 1-second recognition.
2. **Den Labs ya quedó bien posicionada en V3.5** como respaldo en h01/h08/h09. No requiere más cambios.
3. **Founders están subdimensionados en h08.** Cards 240×300 se sienten secundarias frente a la escena entera; nombres (22px) compiten poco contra el watermark "100+".
4. **Cierre h09 está cerca pero falta declaración explícita de marca.** El nombre "Chesscito" sólo aparece en el URL, no como statement.
5. **MiniPay + Celo ya están consolidados** vía pills en h04 + footer h09 ("Powered by Celo") — no requieren más.

El problema no es que falten elementos. El problema es que **Chesscito no domina visualmente.**

---

## B. Sistema consolidado de marca

### Tier 1 — CHESSCITO (dominante, persistente)

| Recurso | Aplicación |
|---|---|
| **BrandMasthead (NUEVO)** | Persistent eyebrow top-center en TODAS las escenas A-Cut: `CHESSCITO · juegos preajedrecísticos`. Always-on. Resuelve la regla del 1-second recognition. |
| Badge h01 | Mantiene "CHESSCITO · JUEGOS PREAJEDRECÍSTICOS" como anchor de apertura |
| Wordmark hero h09 (NUEVO) | "CHESSCITO" gigante serif arriba del title como declaración de cierre |

### Tier 2 — by Den Labs (respaldo)

Sin cambios vs V3.5. Footer en h01/h08/h09.

### Tier 3 — MiniPay + Celo (ecosistema)

Sin cambios vs V3.5. Pills en h04, microcopy CTA, footer h09.

### Tier 4 — @AKAwolfcito (autor)

Sin cambios vs V3.5. Footer h09 únicamente.

### Tier 5 — Founders (peso real)

| Cambio | h05 | h08 |
|---|---|---|
| Portrait size | md (360×450) — sin cambio | **sm → md (240×300 → 360×450)** |
| Name typography | 16px tracked → **24px serif primary** | 22px → **30px serif primary** |
| Role | uppercase tracked cognac — sin cambio | refinar weight |
| Tagline | — | mantener italic 16-18px |

---

## C. Cambios escena por escena

| Escena | Cambio | Conserva |
|---|---|---|
| **h01 Hook** | + masthead top-center | badge centered, title, footer "BY DEN LABS" |
| **h02 Problem** | + masthead | timeline editorial, hairline, value cards |
| **h03 Capability** | + masthead | phone, pills, badge "MÉTODO REAL" |
| **h04 Solution** | + masthead | text-left + phone-right, "POWERED BY CELO" microcopy, CTA |
| **h05 Coach** | + masthead. **Statement +20%, signature primary +6px** | KnightMark, César portrait live, statement copy |
| **h06 Arena** | + masthead | phone protagonist, badge ARENA, pills |
| **h07 Celebration** | + masthead | progress UI, sparkles, pills |
| **h08 Origin** | + masthead. **Founders bumped sm → md (360×450). Names 22 → 30px serif primary. 100+ watermark intacto.** | título, subtitle, caption "Retos diseñados...", footer BY DEN LABS |
| **h09 CTA** | + masthead. **CHESSCITO wordmark hero arriba del title (44-52px serif espresso).** | title, CTA, URL, footer extendido |

### Resumen de impacto

| Escena | Antes (recognition al 1s) | Después |
|---|---|---|
| h01 | Fuerte (badge) | Más fuerte (badge + masthead + footer) |
| h02-h07 | Débil (anonymous editorial) | **Fuerte (masthead persistente)** |
| h08 | Medio (subtitle menciona Chesscito) | **Fuerte (masthead + cards 360×450 + watermark + footer)** |
| h09 | Medio (URL) | **Máximo (masthead + wordmark hero + URL + footer extendido)** |

---

## D. Recomendación visual final

La pieza clave es el **BrandMasthead persistente** — una sola línea editorial top-center con `CHESSCITO · juegos preajedrecísticos` siempre presente. Resuelve el 1-second rule sin saturar (es subtle por color y tamaño, pero always-on).

Complementado con:

1. **Founders bumped a md** en h08 — gravitas real, no añadido tardío.
2. **CHESSCITO wordmark hero** en h09 — cierre con declaración explícita.
3. Sistema light editorial **completamente preservado** — paper cream warm, cognac, serif espresso, sombras suaves.

Resultado: cualquier frame del deck tiene "CHESSCITO" en la mirada periférica (masthead), y los frames clave (h01, h08, h09) lo gritan claramente con triple anchor.

---

## Implementación

- Helper nuevo: `apps/video/src/scenes/pitch/_shared/BrandMasthead.tsx`
- Mantener `BrandFooter.tsx` V3.5 (sin cambios)
- Editar 9 escenas A-Cut para incluir `<BrandMasthead />` antes del closing `</AbsoluteFill>`
- Editar `PitchTeamMini.tsx` para portraits md + names 30px
- Editar `PitchCTA.tsx` para wordmark hero arriba del title

B-Cut sin tocar. MP4 final no se renderiza hasta aprobación de los frames V3.6.
