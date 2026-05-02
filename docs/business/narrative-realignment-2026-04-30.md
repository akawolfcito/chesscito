# Chesscito — Plan de realineación narrativa (2026-04-30)

> Visión: **Chesscito es una experiencia de bienestar cognitivo lúdico, basada en juegos pre-ajedrecísticos, con acceso gratuito y sostenida por una economía transparente sobre Celo/MiniPay.**
> Slogan: **Pequeñas jugadas. Grandes hábitos mentales.**
> Pilar: metodología pre-ajedrecística de César Litvinov Alarcón (Maestro FIDE).

---

## 1. Auditoría — estado actual

### Veredicto general
La narrativa **ya está bien encaminada en la landing nueva** (`LANDING_COPY` en `editorial.ts:1022-1325`). Los problemas reales viven **dentro del app** — sobre todo en los flujos transaccionales (Victory claim, PRO, Shop, Coach), donde blockchain todavía aparece como protagonista en lugar de infraestructura.

### Resumen por severidad
| Severidad | # | Categoría |
|---|---|---|
| BLOCKER (claims médicos) | **0** | — |
| HIGH (cripto-protagonista, PRO mal enmarcado) | **6** | PRO tagline, Victory "onchain" ×3, copy de claim |
| MEDIUM (jerga cripto innecesaria) | **8** | "USDC", "minted to wallet", "VictoryNFT mint", "NFT Claimed" |
| LOW (pulido) | **2** | matices de tono |

### Lo que ya está bien (mantener)
- Disclaimer médico correcto en `LANDING_COPY:1033` y `WHY_PAGE_COPY:948` (deprecado pero válido).
- Narrativa de César Alarcón Maestro FIDE presente en landing (líneas 1228, 1277, 1286-1289).
- Legal copy (`Terms`/`Privacy`) — blockchain mencionado correctamente como contexto técnico, sin venderlo como protagonista.
- Tier `GRATUITO` con framing "acceso real, no demo".
- Frase madre ya activa como meta title + hero.

### Lo que choca con la visión (ranking)

#### HIGH — bloquea alineación
1. **`PRO_COPY.tagline` (editorial.ts:873)** — `"Unlimited AI coach for serious players."` Posiciona PRO como consumo ilimitado, no como plan de entrenamiento + sostenibilidad.
2. **`VICTORY_CLAIM_COPY` (editorial.ts:368, 375, 378, 380, 409)** — `"onchain"` aparece 5×. Blockchain protagónico en flujo emocional (post-victoria) cuando debería ser infraestructura silenciosa.
3. **`PRO_COPY.perksActive` (editorial.ts:884)** — solo `"Unlimited Coach analyses — no credit cap"`. Falta el ángulo "tu aporte sostiene el acceso gratuito" que ya está en la landing.

#### MEDIUM — jerga que excluye no-cripto
4. **`SHOP_ITEM_COPY.founderBadge.subtitle` (editorial.ts:859)** — `"minted to your wallet"` lee como jerga.
5. **`VICTORY_CLAIM_COPY.claimedBadge` (editorial.ts:400)** — `"Victory NFT Claimed"` — "NFT" sin contexto.
6. **`COACH_COPY.buyWithUsdc` (editorial.ts:691, aprox)** — `"Buy with USDC"` asume conocimiento de stablecoins.
7. **`ARENA_COPY.prizePoolSoonHint` (editorial.ts:575)** — `"20% of every Victory mint"` — "mint" innecesario para entender el concepto.
8. **`PRO_COPY.perksRoadmap[2]` (editorial.ts:889)** — `"Discounted VictoryNFT mints"` — mejor "Discounts on victory cards" si NFT no es el atractivo.

---

## 2. Cambios de copy — surface por surface

> **Convención**: cada cambio incluye archivo, línea aproximada, BEFORE → AFTER. Todos los strings van por `editorial.ts` (single source of truth, regla del proyecto).

### A. PRO Card (HIGH PRIORITY)
**Archivo**: `apps/web/src/lib/content/editorial.ts:872-901` (`PRO_COPY`)
**Componentes**: `apps/web/src/components/pro/pro-chip.tsx`, `pro-sheet.tsx`

| Campo | BEFORE | AFTER |
|---|---|---|
| `label` | `"Chesscito PRO"` | (mantener) |
| `tagline` | `"Unlimited AI coach for serious players."` | `"Your training plan. Your way to keep Chesscito free for everyone."` |
| `subtitle` | `"Monthly pass. Manual renewal. No auto-billing."` | `"Monthly pass that supports open access. Renew when you want — no auto-billing."` |
| `priceLabel` | `"$1.99 / month"` | (mantener) |
| `ctaBuy` | `"Get PRO"` | `"Start training"` |
| `ctaActive` | `"PRO Active"` | (mantener) |
| `ctaRenew` | `"Renew PRO"` | `"Extend training"` |
| `perksActive` | `["Unlimited Coach analyses — no credit cap"]` | `["AI Coach with no daily limit", "Your contribution keeps Chesscito free for new players", "Early access to new challenges"]` |
| `perksRoadmap` | `["Tournament priority access (coming soon)", "Premium achievements (coming soon)", "Discounted VictoryNFT mints (coming soon)"]` | `["Tournament priority (coming soon)", "Premium achievements (coming soon)", "Discounts on victory cards (coming soon)"]` |
| `errors.notConfigured` | `"PRO is not yet active. Check back shortly."` | (mantener) |

**Nuevo string a agregar**:
```ts
missionNote: "Every PRO subscription helps us keep the free tier open for new players, families, and schools.",
```
Renderizar en `ProSheet` debajo de `perksActive`, antes del CTA.

### B. Victory Claim flow (HIGH PRIORITY)
**Archivo**: `apps/web/src/lib/content/editorial.ts:366-423` (`VICTORY_CLAIM_COPY`)
**Componentes**: `apps/web/src/components/arena/arena-end-state.tsx`, `apps/web/src/app/arena/page.tsx`

| Línea | Campo | BEFORE | AFTER |
|---|---|---|---|
| 367 | `claimButton` | `"Claim Victory"` | `"Save this Victory"` |
| 368 | `claimHelper` | `"Claim your onchain victory and unlock your share card"` | `"Save this victory permanently and unlock your share card"` |
| 370 | `teaserLabel` | `"Unlock on claim"` | `"Unlock when you save"` |
| 374 | `claiming` | `"Claiming Victory..."` | `"Saving your victory..."` |
| 375 | `claimProgress1` | `"Recording your result onchain"` | `"Recording your result"` |
| 376 | `claimProgress2` | `"Preparing your victory card"` | (mantener) |
| 378 | `successSubtitle` | `"Your onchain result is live. Your share card is ready."` | `"Your victory is saved. Your share card is ready."` |
| 380 | `errorSubtitle` | `"Something went wrong while saving your result onchain."` | `"Something went wrong while saving your result."` |
| 400 | `claimedBadge` | `"Victory NFT Claimed"` | `"Victory Saved"` |
| 409 | `errorKindCopy.error.subtitle` | `"...saving your result onchain."` | `"...saving your result."` |

**Razón**: el usuario no necesita saber "onchain" para entender que su victoria queda guardada. La palabra debe vivir solo en legal/about, no en el flujo emocional.

### C. Shop items (MEDIUM PRIORITY)
**Archivo**: `apps/web/src/lib/content/editorial.ts:856-865` (`SHOP_ITEM_COPY`)

| Campo | BEFORE | AFTER |
|---|---|---|
| `founderBadge.label` | `"Founder Badge"` | (mantener) |
| `founderBadge.subtitle` | `"Support Chesscito with an exclusive founder badge minted to your wallet."` | `"Support the mission from its earliest days. An exclusive badge that's yours to keep."` |
| `retryShield.label` | `"Retry Shield"` | (mantener) |
| `retryShield.subtitle` | `"Three retries for tough captures. Use one and the trial resets — no streak penalty."` | `"Protect your practice rhythm. Three retries for tough captures — keep going without losing your streak."` |

**Agregar nuevo bloque para Coach Packs** (actualmente sin copy específico de microcompra emocional):
```ts
coachPack: {
  label: "Coach Credits",
  subtitle: "Try AI analysis without committing to a subscription.",
  pack5: "5 analyses",
  pack20: "20 analyses",
}
```

### D. Coach paywall (MEDIUM PRIORITY)
**Archivo**: `apps/web/src/lib/content/editorial.ts:670-720` (`COACH_COPY`)
**Componentes**: `apps/web/src/components/coach/*` (oculto detrás de `NEXT_PUBLIC_ENABLE_COACH`)

| Campo | BEFORE | AFTER |
|---|---|---|
| `welcomeTitle` | `"Meet Your Coach"` | (mantener) |
| `welcomeSub` | `"Get personalized analysis of your games — mistakes, lessons, and what you did well."` | `"A learning companion that helps you understand your decisions and improve step by step."` |
| `welcomeNote` | `"After your free analyses, credit packs start at $0.05"` | `"Free analyses to start. After that, credit packs from $0.05."` |
| `buyWithUsdc` | `"Buy with USDC"` | `"Buy with stablecoin"` |
| `creditExplain` | `"1 credit = 1 full game analysis by AI coach"` | `"1 credit = 1 full game analysis"` |

### E. Arena copy (MEDIUM PRIORITY)
**Archivo**: `apps/web/src/lib/content/editorial.ts:527-581` (`ARENA_COPY`)

| Línea | Campo | BEFORE | AFTER |
|---|---|---|---|
| 575 | `prizePoolSoonHint` | `"Distribution v2 coming — 20% of every Victory mint"` | `"Distribution v2 coming — 20% of every saved victory funds the community pool."` |

### F. Disclaimer global (BLOCKER prevention)
**Acción**: Asegurar que el disclaimer de la landing también aparezca **al menos una vez en el app principal** — propongo footer del `/play-hub` en formato compacto.

**Nuevo string en editorial.ts**:
```ts
export const COGNITIVE_DISCLAIMER_COPY = {
  short: "Chesscito is a playful cognitive companion. It does not replace medical diagnosis or treatment.",
  full: "Chesscito is a playful cognitive companion experience. It does not replace medical diagnosis, treatment, or professional therapy.",
} as const;
```

Renderizar `short` en footer del play-hub y arena; `full` ya está en landing + a agregar a `/about`.

---

## 3. Cambios de jerarquía visual

### Play Hub
- **Sin cambios estructurales**, solo copy.
- Reordenar perks de PRO sheet: el "missionNote" va antes que el CTA, no después — refuerza el "por qué" antes del "cuánto".

### Victory end-state
- **Sin cambios estructurales**, solo copy.
- Considerar mover el chip "Victory Saved" a un tono más cálido (ya hay design tokens; sólo intercambio de string).

### Landing
- **Sin cambios** — el copy actual ya está alineado. Sólo verificar que el redirect `/why → /` siga funcionando.

### Footer global
- **Agregar disclaimer corto** en footer de play-hub y arena (componente reutilizable: `<CognitiveDisclaimer variant="short" />`).

---

## 4. Lo que dejamos para después

| Item | Razón |
|---|---|
| **Traducción ES del app interno** | Hoy la landing es ES, el app es EN. Mantener así para Phase 0 — la traducción del app es un sprint dedicado. |
| **Coach paywall público** | El flag `NEXT_PUBLIC_ENABLE_COACH` sigue oculto hasta validar UX y métricas Phase 0 de PRO. |
| **Familia tier** | Waitlist / "Próximamente" — no implementado. |
| **Educadores tier B2B** | Página existe en landing como tier informativo; landing page dedicada B2B viene después. |
| **VictoryNFT discount para PRO** | Roadmap copy. NO prometer hasta que la lógica EIP-712 reconozca PRO. |
| **Premium achievements** | Roadmap copy. NO listar logros específicos. |
| **Tournament priority** | Roadmap copy. NO mencionar fechas. |
| **Sponsor-a-player / Sponsor-a-school** | Pertenecen a página B2B futura. |
| **Eliminar `WHY_PAGE_COPY` del bundle** | Ya está deprecado y `/why` redirige a `/`. Limpieza puede esperar a un commit de housekeeping. |

---

## 5. Riesgos de prometer cosas no implementadas

| Promesa | Estado real | Riesgo | Mitigación |
|---|---|---|---|
| "Tu aporte sostiene el acceso gratuito" | ✅ Real (PRO revenue → treasury → soporta operación) | Bajo | Mantener honesto en copy; no implicar redistribución directa. |
| "Discounts on victory cards (coming soon)" | ❌ Lógica EIP-712 no reconoce PRO | Medio si se implementa antes que el código | Etiquetar **siempre** con "(coming soon)". |
| "Premium achievements (coming soon)" | ❌ No implementado | Bajo | Mantener "(coming soon)" hasta lanzamiento. |
| "Tournament priority (coming soon)" | ❌ Torneos no existen | Bajo | "(coming soon)" obligatorio. |
| "Community prize pool" | ⚠️ El pool acumula on-chain pero no hay método de payout | **Medio-Alto** | El copy `prizePoolSoonHint` ya dice "Distribution v2 coming" — mantener esa transparencia. |
| "Early access to new challenges" (PRO perk nuevo propuesto) | ⚠️ No existe mecanismo de feature-flag por wallet | **Medio** | Solo agregarlo al perks list cuando exista al menos un challenge gateado. **Recomiendo dejarlo OUT del Phase 0** y agregar en commit posterior. |
| "Save this Victory" sin mencionar NFT | ✅ Es un NFT, pero el usuario no necesita el término | Bajo | Mantener "Victory NFT" sólo en legal/terms. |
| Disclaimer médico fuera de landing | ✅ Reglamentado por proyecto | Bajo | Agregar variante corta en footer del app. |

**Recomendación fuerte**: NO agregar `"Early access to new challenges"` al `perksActive` hasta que exista feature-flag real. En su lugar, dejarlo en `perksRoadmap` con `(coming soon)`.

---

## 6. Acceptance criteria

El trabajo está listo cuando:

1. ✅ `PRO_COPY.tagline` no menciona "unlimited" como gancho principal; menciona "training plan" + "open access" o equivalente.
2. ✅ La palabra "onchain" no aparece en `VICTORY_CLAIM_COPY` ni en ningún copy de flujo emocional (post-victoria, claim button, share). Sólo permitida en legal/terms/about.
3. ✅ "NFT" no aparece en `VICTORY_CLAIM_COPY.claimedBadge` ni en `SHOP_ITEM_COPY`.
4. ✅ "USDC" en Coach paywall reemplazado por "stablecoin" (o sólo "Buy" con detalle en hover/tooltip).
5. ✅ Disclaimer cognitivo aparece al menos en: `landing` (ya), `/about`, footer de `/play-hub`, footer de `/arena`.
6. ✅ Founder Badge subtitle remarca "support the mission" antes de "minted to wallet" (orden semántico: misión > mecánica).
7. ✅ Retry Shield subtitle empieza con "Protect your practice rhythm" (no con "Three retries").
8. ✅ PRO sheet incluye `missionNote` visible antes del CTA.
9. ✅ Cero promesas sin asterisco en perks: todo lo no-implementado lleva "(coming soon)".
10. ✅ `git grep "Alzheimer\|demencia\|trat amiento\|cura"` retorna sólo el disclaimer (con "no reemplaza").
11. ✅ Pitch test: un familiar/educador no-cripto puede leer la PRO sheet y entender qué obtiene + por qué pagar sin necesitar Google.
12. ✅ Tests existentes pasan (snapshot tests si existen para editorial.ts; sino, smoke test manual en `/play-hub` y `/arena`).

---

## 7. Plan de commits (granulares, atómicos, en orden)

> Regla del proyecto: un cambio lógico por commit, con footer `Wolfcito 🐾 @akawolfcito`.

### Phase 1 — Copy core (alta prioridad, low risk)
1. **`feat(copy): rebrand PRO tagline + add mission note`**
   - Edita `editorial.ts` — sólo `PRO_COPY` (tagline, subtitle, ctaBuy, ctaRenew, perksActive, perksRoadmap, missionNote nuevo).
   - Toca `pro-sheet.tsx` para renderizar `missionNote`.
   - Test manual: `/play-hub` → ProSheet abre, copy nuevo visible.

2. **`feat(copy): remove blockchain protagonist from victory claim flow`**
   - Edita `editorial.ts` — sólo `VICTORY_CLAIM_COPY` (claimButton, claimHelper, teaserLabel, claiming, claimProgress1, successSubtitle, errorSubtitle, claimedBadge, errorKindCopy.error).
   - Sin cambios de componente.
   - Test manual: ganar partida en `/arena`, verificar copy en claim flow.

3. **`feat(copy): humanize shop item subtitles`**
   - Edita `editorial.ts` — `SHOP_ITEM_COPY` (founderBadge.subtitle, retryShield.subtitle) + nuevo bloque `coachPack`.
   - Test manual: shop sheet en `/play-hub`.

4. **`feat(copy): soften coach paywall language`**
   - Edita `editorial.ts` — `COACH_COPY` (welcomeSub, welcomeNote, buyWithUsdc, creditExplain).
   - Test manual: detrás del flag `NEXT_PUBLIC_ENABLE_COACH=true` localmente.

5. **`feat(copy): add cognitive disclaimer to play-hub and arena footers`**
   - Edita `editorial.ts` — agregar `COGNITIVE_DISCLAIMER_COPY`.
   - Crea componente `apps/web/src/components/legal/cognitive-disclaimer.tsx` (reusable, dos variants).
   - Renderiza variant `short` en footer de `play-hub-root.tsx` y `arena/page.tsx`.
   - Test manual: scroll a footer en ambas rutas.

### Phase 2 — Refinamiento (medium priority)
6. **`feat(copy): refine arena prize pool framing`**
   - Edita `editorial.ts` — `ARENA_COPY.prizePoolSoonHint`.
   - Sin cambios de componente.

7. **`feat(copy): add cognitive disclaimer to about page`**
   - Edita `editorial.ts` — `ABOUT_COPY` (agregar campo `disclaimer` o renderizar componente).
   - Edita `apps/web/src/app/about/page.tsx`.

### Phase 3 — Cleanup (baja prioridad, opcional)
8. **`chore(copy): remove deprecated WHY_PAGE_COPY`**
   - Edita `editorial.ts` — elimina líneas 911-1002.
   - Verifica que ningún componente importa `WHY_PAGE_COPY`.
   - Reduce bundle size.

9. **`docs: update business memory with new narrative direction`**
   - Edita `MEMORY.md` para reflejar la realineación.

### Phase 4 — Verificación final
10. **Smoke test manual** en viewport móvil (390px):
    - Landing `/` — sin cambios, verificar redirect `/why → /`.
    - `/play-hub` — PRO chip + sheet con copy nuevo + footer con disclaimer.
    - `/arena` (entrada directa) — soft gate + prize pool hint nuevo.
    - `/arena` (post-victoria) — claim flow sin "onchain".
    - Shop sheet en play-hub — Founder Badge + Retry Shield con subtitles humanos.
    - Coach paywall (con flag) — sin "USDC" como gancho.

11. **Test en MiniPay** real si es posible (o emulator).

12. **Grep final**:
    ```bash
    git grep -i "onchain" apps/web/src/lib/content/editorial.ts
    # debe mostrar 0 resultados en VICTORY_CLAIM_COPY
    git grep -i "unlimited" apps/web/src/lib/content/editorial.ts | grep -i pro
    # debe mostrar 0 resultados
    ```

---

## 8. Estimación

| Phase | Effort | Riesgo |
|---|---|---|
| Phase 1 (5 commits) | ~2h | Bajo (sólo copy) |
| Phase 2 (2 commits) | ~30min | Muy bajo |
| Phase 3 (2 commits) | ~30min | Bajo (deprecation) |
| Phase 4 (verificación) | ~45min | — |
| **Total** | **~3.5h** | **Bajo overall** |

---

## 9. Pregunta abierta para el usuario antes de implementar

1. **PRO `perksActive` propuesto**: ¿agregamos `"Early access to new challenges"` aún sin feature-flag implementado? Mi recomendación es **NO** y dejarlo en `perksRoadmap` con `(coming soon)`. Confirmar.
2. **Tono del PRO tagline**: opciones —
   - A) `"Your training plan. Your way to keep Chesscito free for everyone."` (mi recomendación)
   - B) `"A monthly training pass that supports open access."`
   - C) `"Train deeper. Help others start."`
3. **Idioma del app interno**: ¿lo dejamos en EN como ahora (Phase 0) o queremos un sprint dedicado para traducir todo a ES? Mi recomendación: **dejar EN para Phase 0**, traducir en sprint dedicado post-medición.
4. **Disclaimer en arena/play-hub**: ¿lo queremos siempre visible (footer fijo) o sólo en una entrada (about + landing)? Recomiendo **footer compacto en play-hub + arena** para que aparezca cada vez que el usuario juega.
