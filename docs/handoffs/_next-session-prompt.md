# Next session prompt — Theme-builder Quick Win #1

Decí **"continuemos"** y el agente lee este archivo y lo sigue.

> Nota: el track anterior de este archivo (Frente 1 — pulir ejercicios) sigue vigente como prioridad
> aparte; su contexto vive en `docs/product/2026-07-13-direction-where-we-are.md`. El founder pidió
> explícitamente que la próxima sesión arranque por el Quick Win #1 del theme-builder.

---

## Contexto
El theme-builder (`/dev/theme-builder`) está **mergeado a `main`** — catálogo de arte con **162 slots**
en ~18 categorías. Handoff completo: `docs/handoffs/2026-07-18-theme-builder-catalog-handoff.md`
(leer PRIMERO — tiene los modelos, el método de gap, y la aclaración "qué funciona hoy vs B2").

## La tarea: Quick Win #1 — localizador preciso de uso
Enriquecer `usedIn` de cada slot con el **componente/pantalla exacto** que lo consume, para poder ir
al app y validar visualmente. Hoy `usedIn` es descriptivo ("Kingdom scene"); el founder necesita saber
el archivo/pantalla real — sobre todo los "misteriosos" que solo se ven en CSS y no se sabe dónde
renderizan (ej. `shop.slot-frame`, `scene.pedestal`, `scene.stone-*`, `bg.*`).

**Enfoque:** por cada basename registrado, `grep -rl` el consumidor en `src/` → poblar `usedIn` con
el path del componente. Acotado, una tanda + smoke test. NO es #4 (multi-theme) — eso es sesión aparte.

## Reglas heredadas (de esta línea)
- **Higiene de comandos**: `git -C`/`pnpm -C`, un comando por tool, sin `cd`, sin heredocs (commit con
  `-F archivo`). `find` sin predicados compuestos (rtk los rechaza).
- **Verificar cada lote**: typecheck + `vitest run src/lib/themes` + smoke test (curl `/dev/theme-builder`,
  contar `>no file<` = 0). Limpiar `.next/cache/webpack` si el dev server tira 404 (caché corrupta).
- **Commit por iteración.** Firma `Wolfcito 🐾 @akawolfcito`.
- **NO verificar deploys** — el founder lo ve visualmente.

## Memoria relevante
[[project_theme_catalog_decisions]] · [[project_theme_system_foundation]] ·
[[feedback_grep_audit_misses_composed_paths]] (el gap se mide con literal-diff, NO por-superficie).
