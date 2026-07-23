# Handoff — Observabilidad Lote 1

**Fecha:** 2026-07-23 · **Rama:** `feat/observability-lote-1` · **Autor:** Wolfcito 🐾 @akawolfcito
**Base:** audit `docs/audits/2026-07-23-product-observability-audit.md` + spec
`docs/specs/2026-07-23-observability-lote-1-spec.md` (ambos aprobados).

> ⛔ **STOP alcanzado a propósito:** NO se aplicaron migraciones a producción.
> El merge a `main` local y el push a `origin/main` los hace el founder.

---

## Estado — LISTO (10 commits atómicos en la rama)

1. `feat(analytics): split anonymousId vs visitId session semantics`
2. `feat(db): additive analytics dimension columns` (migración)
3. `feat(db): session_first_seen cohort table` (migración)
4. `feat(analytics): enrich events with dims + server-side country`
5. `feat(analytics): app_opened once-per-visit root event`
6. `feat(analytics): canonical activation-funnel event map (read-time shim)`
7. `feat(stats): surface/container filters + app opens + activation funnel`
8. `feat(stats): top countries + D1/D7 retention UI + filter controls`
9. `docs(privacy): declare anonymous product analytics (EN/ES)`
10. `fix(analytics): make clientDimensions fail-open (never throw into track)`

### Verificación
- **Suite completa:** 5739 passing / 510 files, **0 fallas, sin ELIFECYCLE** (job verde limpio).
- **Typecheck:** `pnpm exec tsc --noEmit` limpio.
- **Migraciones:** ensayadas contra **Supabase local** (docker `supabase_db_web`): aplican
  limpio, idempotentes (constraint DO-guarded), CHECK de country rechaza `us`/acepta `US`/null,
  `on conflict do nothing` conserva la cohorte original.
- **Visual /stats:** capturado default + `?surface=learn&container=minipay`. Filtros con estado
  activo, sección Acquisition & Activation, degradación graceful (em-dash) cuando la DB no tiene
  aún las columnas nuevas → confirma el fail-open. (Capturas en scratchpad, efímeras.)

---

## Qué quedó implementado

- **Sesión:** `session_id` = anonymous_id persistente (retención). `visit_id` nuevo
  (sessionStorage). `lib/analytics/identity.ts`.
- **Dimensiones** (columnas nullable en `analytics_events`): surface, container, locale, country,
  source, campaign, app_version, visit_id. Normalizadores puros allow-list compartidos
  client+server (`lib/analytics/dimensions.ts`). **country solo server-side** desde
  `x-vercel-ip-country` (ISO-2, nunca IP/ciudad).
- **Atribución first-touch** persistida (`lib/analytics/attribution.ts`).
- **`app_opened`** once-per-visit (`components/analytics/analytics-boot.tsx` en `layout.tsx`) +
  upsert idempotente de `session_first_seen`.
- **Funnel canónico** read-time (`lib/analytics/canonical-events.ts`) — sin renombrar los ~120.
- **/stats:** filtros server-side por querystring (`unstable_cache` keyed, revalidate 3600),
  App Opens, activación, top countries, retención D1/D7. Una sola página.
- **Privacy Policy EN/ES** declara analytics anónima, país aproximado, no-IP-completa, retención.

---

## Próximos pasos (founder / próxima sesión) — EN ORDEN

1. **Revisar la rama** y mergear a `main` local; push a `origin/main` (founder).
2. **⚠️ GATE DE PRIVACIDAD:** publicar la Privacy Policy actualizada (deploy) **ANTES** de
   activar la captura de `country` en prod. El commit 9 ya trae la copy; solo debe estar **live**.
3. **Aplicar las 2 migraciones a producción** (`20260723040000_analytics_dimensions.sql`,
   `20260723041000_session_first_seen.sql`). Aditivas y probadas en local. **Yo NO las apliqué.**
4. **Env de prod:** confirmar `NEXT_PUBLIC_BUILD_SHA` (ya seteado en `next.config.js` desde
   `VERCEL_GIT_COMMIT_SHA`). El país depende de que Vercel inyecte `x-vercel-ip-country` (default
   en el edge).
5. Verificar visualmente `/stats` con datos reales una vez propaguen los primeros `app_opened`.

---

## Fuera de alcance (confirmado, para Lote 2)

Reconciliación server-authoritative de pagos/rewards · métricas on-chain §8 completas (network
fees, failed-tx) · retención D30/D3/D21 · renombrar todo el catálogo · SaaS · warehouse.

## Open questions

- ¿La captura de `country` requiere además una nota en la pantalla de consentimiento in-app, o
  basta la Privacy Policy? (El listing MiniPay exige links a ToS/Privacy accesibles in-app —
  ya existen `/privacy` y `/terms`.)
- Retención: los umbrales de cohorte (D1 en edad [1,8], D7 en [7,14]) son un default razonable a
  bajo volumen; revisar cuando haya datos reales por si conviene ampliar la ventana.
