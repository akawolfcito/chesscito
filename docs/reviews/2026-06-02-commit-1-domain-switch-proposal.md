# Commit 1 — Propuesta de patch: vercel.app → www.chesscito.com

**Estado:** PROPUESTA. No se han modificado archivos.
**Espera:** confirmación del usuario para ejecutar Edits.

---

## Decisión registrada

**Dominio canónico user-facing = `https://www.chesscito.com`** (no apex).

Razón: per `share-previews` HARD RULE (MEMORY) — apex `chesscito.com` 307s a `www`. Submitir el campo App URL apuntando al apex obligaría a MiniPay WebView a hacer un hop de redirect antes del primer render. Submitir `www` directo elimina el hop.

**App URL específica para MiniPay (campo `linkUrl`)** — **DECISIÓN PENDIENTE**.

Candidatos:

| Candidato | Pros | Contras |
|---|---|---|
| `https://www.chesscito.com` (raíz) | Camino actual ya validado. `landing-page.tsx:90` auto-redirige a `/hub` cuando `isMiniPay === true`. Robusto si por cualquier razón el redirect falla (no queda en pantalla muerta). | 1 redirect interno antes del home real. Suma al LCP en MiniPay WebView. |
| `https://www.chesscito.com/hub` | Entry directo al home real, sin hop. Mejor LCP en MiniPay. Asume que `/hub` carga aislado sin pasar por landing. | No validado: ¿es más liviano? ¿soporta 360×640? ¿zero-click connect activa? ¿footer expone Support/Terms/Privacy? ¿se rompe si el usuario llega sin estado de sesión previo? |

**Acción pendiente antes de definir:** validar `/hub` contra los 4 criterios del usuario (lighter, stable, 360×640, zero-click, expone links legal/support). Esto se cubrirá en commits 3 (re-medir PageSpeed) + 5 (fixture 360×640) + 7 (validación manual zero-click) + audit footer.

**Default propuesto para este commit:** dejar `App URL (linkUrl)` como `https://www.chesscito.com` con flag `DECISION PENDING — candidate /hub`. Cuando los 4 criterios se validen contra `/hub`, hacemos un commit posterior específico para mover el campo.

---

## Archivos a tocar (4)

### 1. `docs/minipay-submission.md`

**Cambios línea por línea:**

| Línea | Antes | Después |
|---|---|---|
| 13 | `\| Support URL \| https://chesscito.vercel.app/support \|` | `\| Support URL \| https://www.chesscito.com/support \|` |
| 14 | `\| Terms of Service \| https://chesscito.vercel.app/terms \|` | `\| Terms of Service \| https://www.chesscito.com/terms \|` |
| 15 | `\| Privacy Policy \| https://chesscito.vercel.app/privacy \|` | `\| Privacy Policy \| https://www.chesscito.com/privacy \|` |
| 17 | `\| App URL (linkUrl) \| https://chesscito.vercel.app \|` | `\| App URL (linkUrl) \| https://www.chesscito.com  ⚠️ **DECISIÓN PENDIENTE** — candidato `https://www.chesscito.com/hub` (validar liviano + 360×640 + zero-click + links legales antes de submitir) \|` |

Sin otros cambios al doc en este commit. La sección "Pre-Submission Checklist" sigue como está; los items siguen sin marcar porque la decisión `/hub` los re-abre.

---

### 2. `docs/network-manifest.md`

**Cambios:**

| Línea | Antes | Después |
|---|---|---|
| 3 | `**Audit date:** 2026-03-23` | `**Audit date:** 2026-03-23 (last reviewed 2026-06-02 — re-audit pending after domain switch)` |
| 5 | `**App URL:** https://chesscito.vercel.app` | `**App URL:** https://www.chesscito.com (canonical; apex `chesscito.com` 307s to www; vercel.app deprecated 2026-05-20)` |

Sin otros cambios. La tabla de origins externos no cambia con el switch.

---

### 3. `docs/submission/minipay-form-answers.md`

Este archivo YA usa el apex `chesscito.com` (sin `www`) en varias respuestas form-ready. Hay que cambiarlas a `www.chesscito.com` para consistencia con la regla `share-previews`.

**Cambios bulk:** reemplazar `https://chesscito.com/` → `https://www.chesscito.com/` y `chesscito.com/` → `www.chesscito.com/` solo donde aparece como URL pública (no en texto narrativo del Q "Primary domain (custom...)").

**Cambios específicos por línea:**

| Línea(s) | Antes | Después |
|---|---|---|
| 143 | `**\`chesscito.com\`** is the canonical, user-facing domain.` | `**\`www.chesscito.com\`** is the canonical, user-facing domain (apex \`chesscito.com\` 307s to www).` |
| 152 | `\`chesscito.vercel.app\` — legacy URL deprecated on 2026-05-20...` | (sin cambio — referencia histórica al vercel.app legacy, queda intencional) |
| 165 | `Primary domain (user-facing, custom):  chesscito.com` | `Primary domain (user-facing, custom):  www.chesscito.com` |
| 167 | `Legacy domain (deprecated 2026-05-20):  chesscito.vercel.app` | (sin cambio — histórico) |
| 182 | `\`https://chesscito.com/support\`` | `\`https://www.chesscito.com/support\`` |
| 197 | `Web:       https://chesscito.com/support` | `Web:       https://www.chesscito.com/support` |
| 213 | `\| Public URL \| \`https://chesscito.com/terms\` \|` | `\| Public URL \| \`https://www.chesscito.com/terms\` \|` |
| 222 | `https://chesscito.com/terms` | `https://www.chesscito.com/terms` |
| 235 | `\| Public URL \| \`https://chesscito.com/privacy\` \|` | `\| Public URL \| \`https://www.chesscito.com/privacy\` \|` |
| 244 | `https://chesscito.com/privacy` | `https://www.chesscito.com/privacy` |
| 267 | `Operator surface:   https://chesscito.com/about` | `Operator surface:   https://www.chesscito.com/about` |
| 268 | `Legal disclaimer:   https://chesscito.com/terms  (Section 1 — "Independent Operator")` | `Legal disclaimer:   https://www.chesscito.com/terms  (Section 1 — "Independent Operator")` |

**No tocar:** referencias a "x.com", "wa.me", "github.com", el legacy `chesscito.vercel.app` (deprecated 2026-05-20). La narrativa del Q "Primary domain" mantiene el patrón actual; solo el dominio canónico cambia de apex → www.

**Nota:** este archivo NO tiene un campo `App URL (linkUrl)` per se — su único campo equivalente es la respuesta de "Primary domain" donde se aclara que el canonical es `www.chesscito.com`. No requiere el flag `DECISION PENDING /hub` aquí porque la pregunta es sobre dominio, no sobre entrypoint específico.

---

### 4. `apps/web/.env.template`

**Cambio único en comentario (no toca valor de variable):**

| Línea | Antes | Después |
|---|---|---|
| 31 | `# Set to your canonical domain (e.g. chesscito.vercel.app)` | `# Set to your canonical domain (e.g. https://www.chesscito.com)` |

Valor de `NEXT_PUBLIC_APP_URL` (línea 32) sigue vacío — solo template público, el valor real vive en `.env` local y Vercel env vars.

**No tocamos:** ningún otro key del template. Sin nuevos secrets, sin nuevas keys.

---

## Lo que NO se toca en este commit

- `docs/handoffs/2026-05-20-post-domain-migration-addendum-handoff.md` — frozen record de la migración anterior.
- `docs/handoffs/2026-05-21-traceability-hygiene-handoff.md` — frozen.
- `docs/release/2026-05-20-...` y `docs/release/2026-05-04-...` — frozen release records.
- `docs/planning/session-handoff-2026-04-27.md` — frozen.
- `docs/reviews/red-team-*-2026-04-21.md` — frozen audit context.
- `docs/superpowers/plans/*` y `docs/superpowers/specs/*` — frozen specs.
- `docs/pagespeed-report-2026-03-23.md` — frozen measurement record. Se reemplaza por NUEVO doc en commit 3.
- `apps/video/src/scenes/pitch/PitchCTA.tsx`, `apps/video/src/lib/pitch-copy.ts`, `apps/video/src/scenes/CtaOutro.tsx` — separado a posible commit 2 si el video pitch sigue vivo. Confirmar uso antes de tocar.
- `docs/reviews/2026-06-02-celopedia-*` y `docs/reviews/2026-06-02-minipay-readiness-audit.md` y este mismo doc — ya escritos con `www.chesscito.com` o referencian el switch como problema (re-leeré al final del commit para confirmar consistencia).

---

## Verificación post-commit

1. `Grep "chesscito.vercel.app" docs/minipay-submission.md docs/network-manifest.md docs/submission/minipay-form-answers.md apps/web/.env.template` → 1 hit esperado (línea 152 + 167 de form-answers, referencia histórica intencional). Todos los demás deben quedar limpios.
2. `Grep "https://chesscito.com" docs/minipay-submission.md docs/network-manifest.md docs/submission/minipay-form-answers.md` → 0 hits (todo migrado a `www`).
3. No corre build, no corre tests (solo docs + comentario de env template, no consumido en build).

---

## Mensaje de commit propuesto

```
docs(submission): switch canonical app URL from vercel.app preview to www.chesscito.com

- minipay-submission.md: Support/Terms/Privacy URLs migrated; App URL flagged
  DECISION PENDING with /hub candidate pending lightness + 360x640 + zero-click
  + legal-link validation.
- network-manifest.md: header App URL updated; audit date noted for re-review.
- submission/minipay-form-answers.md: apex chesscito.com URLs migrated to
  www.chesscito.com (per share-previews rule: apex 307s to www).
- .env.template: NEXT_PUBLIC_APP_URL example comment updated.

Legacy vercel.app references in handoffs, frozen specs, and historical records
are intentionally preserved as point-in-time evidence.

Wolfcito 🐾 @akawolfcito
```

---

## Próximos commits (recordatorio orden ejecución)

| # | Commit | Estado |
|---|---|---|
| 1 | docs domain switch | **PROPUESTO ahora** |
| 2 | (condicional) apps/video dominio switch | espera confirmación de uso |
| 3 | chore(perf): re-medir PageSpeed mobile vs www.chesscito.com | tras commit 1 |
| 3.5 | (condicional) si /hub se valida + es más liviano → commit "docs(submission): adopt /hub as MiniPay App URL" | tras commits 3 + 5 + 7 |
| 4+ | cluster perf optimizations si <90 | tras commit 3 |
| 5 | test(e2e): add 360x640 viewport fixture | tras commit 1 |
| ... | resto del plan en `docs/reviews/2026-06-02-minipay-readiness-audit.md` | |

---

## Pregunta para ejecutar

¿Procedo a ejecutar este patch tal cual está, o queres ajustes (cambiar el wording del flag `DECISION PENDING`, mover Support/ToS/Privacy a `/hub/...` también, descartar el apps/video commit 2)?
