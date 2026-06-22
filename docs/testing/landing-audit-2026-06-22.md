# Landing Audit — apps/landing — 2026-06-22

Scope: `apps/landing` (www.chesscito.com). Read-only. No code changed.

---

## 1. Current Summary

`apps/landing` is a standalone Next.js 14 app rendering a single-page marketing landing.
It builds and visually works. Key sources:

- `src/app/layout.tsx` — metadata, fonts
- `src/components/landing/landing-page.tsx` — full page
- `src/lib/content/editorial.ts` — all copy (`LANDING_COPY` + `WHY_PAGE_COPY`)
- `src/app/robots.ts` / `sitemap.ts` — SEO routes

**Architecture target** (per B1.3 brief):

| Domain | Product |
|---|---|
| `www.chesscito.com` | Landing (this app) |
| `lite.chesscito.com` | Chesscito Lite |
| `play.chesscito.com` | Chesscito Full |

**Critical finding**: `play.chesscito.com` is referenced **nowhere** in the landing. Every "Start free" CTA routes only to `lite.chesscito.com`. The landing reads as a single-product app.

---

## 2. CTA Inventory

| # | Label | File:line | Destination (current) | Destination (recommended) | Notes |
|---|---|---|---|---|---|
| 1 | Start free (nav) | landing-page.tsx:62 | `${PLAY_URL}/hub` → `lite.chesscito.com/hub` | `lite.chesscito.com/hub` | OK — Lite is entry point |
| 2 | Start free (hero primary) | landing-page.tsx:102 | `${PLAY_URL}/hub` → `lite.chesscito.com/hub` | `lite.chesscito.com/hub` | OK |
| 3 | Learn the why (hero secondary) | landing-page.tsx:107 | `#problem` (internal anchor) | `#problem` | OK |
| 4 | Start free (plans FREE) | landing-page.tsx:530–535 | `${PLAY_URL}/hub` → `lite.chesscito.com/hub` | `lite.chesscito.com/hub` | OK |
| 5 | I want PRO access | landing-page.tsx:519–528 | `mailto:${SUPPORT_EMAIL}?subject=...` or fallback GitHub Issues | Same if email set; GitHub fallback is acceptable | PRO is Full feature — copy should hint Full |
| 6 | Let me know when it's ready (FAMILY) | landing-page.tsx:537–549 | Same mailto/GitHub fallback | Same | OK |
| 7 | Let's talk (EDUCATORS) | landing-page.tsx:537–549 | Same mailto/GitHub fallback | Same | OK |
| 8 | Escríbenos (sponsors) | landing-page.tsx:731–739 | `mailto:${SUPPORT_EMAIL}` — **silently absent if env unset** | Same (shows only if env set) | Disappears without env var — acceptable but needs env set in prod |
| 9 | GitHub Issues (sponsors) | landing-page.tsx:741–749 | `https://github.com/wolfcito/chesscito/issues` | Same | Personal repo URL — verify org vs personal |
| 10 | Start free (final CTA) | landing-page.tsx:772–778 | `${PLAY_URL}/hub` → `lite.chesscito.com/hub` | `lite.chesscito.com/hub` | OK |
| 11 | Talk to the team (final CTA) | landing-page.tsx:780–788 | `mailto:${SUPPORT_EMAIL}?subject=...` — **silently absent if env unset** | Same | Disappears without env var |
| 12 | Privacy (footer) | landing-page.tsx:804–810 | `${LEGAL_URL}/privacy` → `lite.chesscito.com/privacy` | `lite.chesscito.com/privacy` | Route must exist in Lite |
| 13 | Terms (footer) | landing-page.tsx:813–819 | `${LEGAL_URL}/terms` → `lite.chesscito.com/terms` | Same | Route must exist in Lite |
| 14 | Support (footer) | landing-page.tsx:822–828 | `${LEGAL_URL}/support` → `lite.chesscito.com/support` | Same | Route must exist in Lite |
| 15 | About (footer) | landing-page.tsx:831–837 | `${LEGAL_URL}/about` → `lite.chesscito.com/about` | Same | Route must exist in Lite |
| 16 | Stats (footer) | landing-page.tsx:840–846 | `${LEGAL_URL}/stats` → `lite.chesscito.com/stats` | Same | Route must exist in Lite |

**Summary**: 5 of 6 "Start free" / green CTAs go to `lite.chesscito.com/hub`. Zero CTAs point to `play.chesscito.com`. Full is invisible.

---

## 3. Narrative Gaps

| Question | Current state |
|---|---|
| ¿La landing comunica Chesscito como marca? | ✅ Sí — "Chesscito" está en nav, hero, planes, founders, footer. |
| ¿Comunica Chesscito Lite? | ❌ No — la palabra "Lite" no aparece en ningún lugar. |
| ¿Comunica Chesscito Full? | ❌ No — ni "Full" ni `play.chesscito.com` ni el modelo "completa el pre-chess → desbloqueas el ajedrez completo" está presentado como un producto separado con su propio dominio. |
| ¿Parece que solo existe un producto? | ✅ Sí — la landing presenta Chesscito como un solo juego; el §4 "How it works" implica que el ajedrez completo se desbloquea dentro de la misma app. Nadie sabe que hay dos apps en dominios distintos. |

**Additional narrative issues:**

- `hero.subcopy` (editorial.ts:110) y `meta.description` (editorial.ts:95) dicen **"from an early age"** — suena a producto infantil; la sección Audiences dice "any age" y "Casual players & curious beginners". Hay contradicción.
- El eyebrow **"PLAYFUL COGNITIVE WELLNESS"** no menciona ajedrez — puede confundir sobre qué es el producto antes de leer el headline.
- El plan **CHESSCITO PRO** ("AI Coach, Streak Shield, PRO badge, Save victories") describe features que son de la app Full (`play.chesscito.com`), pero el CTA de PRO va a mailto, no a `play.chesscito.com`. No hay forma de que el usuario llegue a Full desde la landing.
- La sección §4 "How it works" termina en **"PLAY — Full chess unlocks itself"** — esto implica que el ajedrez completo es el destino final dentro de la misma app. No hay mención de que existe un segundo app (`play.chesscito.com`) con arena, coach, leaderboard, economía.

---

## 4. Broken / Risky Links

| Link | Risk | Detail |
|---|---|---|
| OG image `/api/og/home` (layout.tsx:37) | 🔴 **Broken** | `apps/landing` no tiene ruta `/api/og/home`. La imagen OG de toda la landing (Twitter card, Facebook share) falla con 404. No hay ningún archivo ni route handler en `apps/landing/src/app/api/`. |
| Apple icon `/apple-icon.png` (layout.tsx:29) | 🟡 Risky | No está en `apps/landing/public/`. Probablemente 404 en Safari/iOS. |
| `/favicon.ico` (layout.tsx:28) | 🟡 Risky | No visible en `apps/landing/public/`. |
| Footer links → `lite.chesscito.com/{privacy,terms,support,about,stats}` | 🟡 Risky | Solo son válidos si esas rutas existen en apps/web Lite. Verificar que no sean 404. |
| GitHub Issues URL (editorial.ts:77) | 🟡 Verify | `https://github.com/wolfcito/chesscito/issues` — ¿es repo personal o de org? Puede devolver 404 si el repo es privado. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` no seteado | 🟡 Silent | 3 CTAs desaparecen (Escríbenos, Talk to the team) y 3 planes caen al fallback GitHub Issues. No es error técnico pero es experiencia degradada. |

---

## 5. SEO / Metadata Notes

| Campo | Valor actual | Estado |
|---|---|---|
| `title` | "Chesscito: Small plays. Big mental habits." | ✅ Bueno |
| `description` | "...decision-making **from an early age**." | ⚠️ "from an early age" es problemático — ver §3 |
| `canonical` | `NEXT_PUBLIC_APP_URL ?? "https://www.chesscito.com"` | ✅ Correcto |
| `metadataBase` | `new URL(BASE_URL)` | ✅ Correcto |
| OG `url` | `BASE_URL` | ✅ Correcto |
| OG `image` | `/api/og/home` (1080×1350 JPEG) | 🔴 Ruta no existe — broken |
| Twitter `card` | `"summary_large_image"` | ✅ Correcto |
| `robots.txt` | Hardcodea `https://www.chesscito.com/sitemap.xml` | ✅ OK, pero no usa env var (minor) |
| `sitemap.ts` | Solo incluye la homepage | ✅ Correcto para single-page landing |
| `themeColor` | `#f6e6b8` (warm cream) | ✅ On-brand |
| `talentapp:project_verification` | Meta tag presente | ✅ (verificación externa, no tocar) |

---

## 6. Assets

| Asset | Location | Estado |
|---|---|---|
| `hero-play-hub.{png,webp,avif}` | `public/art/landing/` | ✅ Presente con triplete |
| `pre-chess-exercise.{png,webp,avif}` | `public/art/landing/` | ✅ Presente — **usada dos veces** (§3 SectionRow + §3 Cognitive). Sería mejor tener una segunda imagen distinta para §3 Cognitive. |
| `progress-trophies.{png,webp,avif}` | `public/art/landing/` | ✅ Presente con triplete |
| Icons redesign (check, chevron-down, coach, etc.) | `public/art/redesign/icons/` | ✅ Todos con triplete |
| `/favicon.ico` | No encontrado en `public/` | 🔴 Falta |
| `/apple-icon.png` | No encontrado en `public/` | 🔴 Falta |
| `/api/og/home` | No existe como route en apps/landing | 🔴 Falta — ver §5 |

---

## 7. Mobile (390px Assessment)

| Elemento | Estado |
|---|---|
| Hero: grid `grid-cols-1` mobile → `grid-cols-2` md | ✅ Stack correcto |
| PhoneStack imagen hero | ✅ `justify-center` en mobile |
| CTAs hero: `w-full flex-col` mobile → `flex-row` md | ✅ Apilados verticalmente en mobile |
| Plans: `snap-x overflow-x-auto min-w-[72%]` | ✅ Scrollable horizontal cards en 390px |
| Secciones: `px-5` en mobile | ✅ Márgenes correctos para 390px |
| Text sizes: `text-[0.95rem]` / `text-sm` base | ✅ Legibles en 390px |
| Footer links: `flex-wrap gap-x-3` | ✅ Se wrappea correctamente |
| Nav: `px-5 py-5` | ✅ Espacio suficiente |

Mobile parece bien manejado. Sin VR de 390px, no se puede confirmar visualmente, pero el código es mobile-first.

---

## 8. Recommended Minimal Changes (no tocar hoy — solo inventario)

### P0 — Broken (bloquean launch)
1. **OG image**: crear `/api/og/home` en apps/landing **o** cambiar a una imagen estática en `public/`. Sin esto, todo share social falla.
2. **favicon.ico + apple-icon.png**: agregar a `apps/landing/public/`.

### P1 — Narrative (requeridos para arquitectura correcta)
3. **Eliminar "from an early age"** de `meta.description` (editorial.ts:95) y `hero.subcopy` (editorial.ts:110). Reemplazar con algo neutral por edad.
4. **Mencionar la dualidad Lite/Full**: en algún lugar de la landing (Plans section o hero subcopy) aclarar que existe Chesscito Lite (entry, free, daily habits) y Chesscito Full / PRO (arena, coach, full chess). Hoy la landing no lo dice.
5. **PRO CTA debe apuntar a `play.chesscito.com`** cuando `NEXT_PUBLIC_FULL_URL` esté seteado, no a mailto (o al menos incluirlo como destino alternativo al mailto).

### P2 — Polish
6. **Segunda imagen para §3 Cognitive**: `pre-chess-exercise` aparece dos veces. Idealmente una imagen distinta para la sección cognitiva (hub, trophies, algo distinto al tablero).
7. **Verificar rutas legales** en Lite: `privacy`, `terms`, `support`, `about`, `stats` — si no existen en apps/web, los footer links son 404.
8. **GitHub Issues URL**: confirmar si `wolfcito/chesscito` es accesible públicamente.

---

## 9. Recommended Env Vars

| Var | Uso | Default actual | Recomendado en prod |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | canonical, metadataBase, sitemap | `https://www.chesscito.com` | `https://www.chesscito.com` |
| `NEXT_PUBLIC_PLAY_URL` | Todos los CTAs "Start free" | `https://lite.chesscito.com` | `https://lite.chesscito.com` |
| `NEXT_PUBLIC_LEGAL_URL` | Footer Privacy/Terms/Support/About/Stats | `PLAY_URL` (= lite) | `https://lite.chesscito.com` (explícito) |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | mailto CTAs (Escríbenos, Talk to team, Plans) | undefined — CTAs desaparecen | Setear en Vercel |
| `NEXT_PUBLIC_FULL_URL` | No existe todavía | — | Agregar: `https://play.chesscito.com` para CTAs de PRO/Full |

---

## 10. Decision

**¿Lista para patch de copy/CTAs?**

**Parcialmente.** La landing es funcional y el código es limpio. Antes del patch de copy:

1. 🔴 Resolver OG image (P0 — broken) — cualquier share en redes sociales devuelve imagen rota.
2. 🔴 Agregar favicon + apple-icon (P0 — assets faltantes).
3. 🟡 Decidir qué narrativa usar para Lite vs Full (P1) — sin esta decisión, el copy patch podría ser inconsistente.

Con esos tres resueltos, el patch de copy y CTAs puede ejecutarse directamente sobre `editorial.ts` + `landing-page.tsx` sin tocar el resto del monorepo.
