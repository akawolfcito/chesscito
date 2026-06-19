# Handoff — Chesscito Lite Mode Phase 1 + Fixes
**Date:** 2026-06-19  
**Branch at close:** `main` @ `36cac882`

---

## Lo que se hizo

### Lite Mode Phase 1 (PR #152, mergeado)
Flag build-time `NEXT_PUBLIC_CHESSCITO_LITE_MODE` para dos proyectos Vercel sobre el mismo repo.

| Archivo | Cambio |
|---|---|
| `src/lib/feature-flags.ts` | `CHESSCITO_LITE_MODE` = `NEXT_PUBLIC_CHESSCITO_LITE_MODE === "true"` |
| `src/lib/lite-mode-routing.ts` | `isFullOnlyPath` + `getLiteHubTarget` (locale-aware, pure functions) |
| `src/middleware.ts` | Redirect 307 Full-only paths → `/hub` (preserva prefijo locale) |
| `src/components/hub/hub-scaffold-client.tsx` | Gates ProSheet/ShopSheet/BadgeSheet/PurchaseConfirmSheet + CTAs Arena/Coach/Pro como `undefined` |

**Full-only paths bloqueados:** `/arena`, `/coach`, `/victory`, `/shop`, `/pro`, `/founder`  
**Tests:** 59/59 nuevos · tsc 0 errores

### Fixes post-smoke (todos en `main`)

| Commit | Fix |
|---|---|
| `65dda937` | `onArenaPress` prop → `undefined` en Lite (early-return no era suficiente — el prop truthy igual renderizaba el botón) |
| `f8be51c3` | Dock center siempre muestra PIECES en Lite (`resolveCenter` cortocircuita) |
| `36cac882` | Dock center `is-active` cuando pathname `/exercises` en Lite |
| `f81e4cc6` | `BASE_URL`: `??` → `||` en `layout.tsx` y `sitemap.ts` (string vacío crasheaba `new URL("")`) |

### Smoke local ✅
```
/arena   → 307 /hub
/coach   → 307 /hub
/victory → 307 /hub
/hub     → 200
/exercises → 200
```

### Board migration
Founder confirmó CERRADO como está (2026-06-19). No hay phases pendientes.

---

## Estado al cierre

- `main` = `origin/main` = `36cac882`
- `production` = no promovida en esta sesión (Lite Mode es feature nueva, no afecta prod Full)
- Lite Mode Phase 2 (bundle optimization) → diferida, no hay fecha

---

## Próxima sesión — db-content Phase 3

### Decisión tomada
Re-open UX = **Opción A**: keep completed + optional extra.  
Nuevos ejercicios de la BD aparecen como contenido adicional; el progreso del jugador no se toca.

### Pasos en orden
1. **Aplicar migración** `content_overlay` en Supabase hosted (aún commit-only, nunca aplicada en hosted)
2. **Flip flag** `CONTENT_OVERLAY_ENABLED=true` en **preview** primero
3. **Observar** logs: `source` (baseline vs overlay), `overlayCount`, latencia
4. Si ok → flip en **prod**
5. Kill-switch = `CONTENT_OVERLAY_ENABLED=false` (flag OFF = 0 DB hits, byte-identical al estado actual)

### Referencias
- Spec: `docs/specs/db-content-overlay-full.md`
- Handoff previo: `docs/handoffs/2026-06-17-db-content-phase2c-handoff.md`
- Memory: `project_db_content_resume_2026_06_17.md`
- Migration SQL: `apps/web/supabase/migrations/` (buscar `content_overlay`)

### Open questions resueltas
- ✅ Re-open UX → Opción A
- ⏳ VR baselines exercises surface → pendiente (no bloqueante para Phase 3)
