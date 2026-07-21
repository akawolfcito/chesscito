# Theme-builder — Landing section (design note, IN PROGRESS)

**Fecha:** 2026-07-18 · **Estado:** brainstorming pausado — decisiones tomadas, diseño NO finalizado, sin plan de implementación aún.

> Objetivo: agregar a `/dev/theme-builder` una sección para los assets de **`apps/landing`**,
> para tener control completo (Replace image / Undo) de todas las apps desde un solo lugar.

## Decisiones tomadas (con el founder)

1. **Alcance** = los **~21 basenames que el landing realmente usa** (referenciados en `apps/landing/src`),
   no todo `public/art` en disco. Catálogo limpio, sin huérfanos. Incluye `landing-slides/*` (marketing,
   exclusivos del landing) + los duplicados propios del landing (`hub/*`, `redesign/*`, `bg-*`).
2. **UI** = **toggle de app arriba** (`Web ↔ Landing`), como el theme picker. `Web` = los 162 slots actuales;
   `Landing` = los ~21. Cada uno se sirve/escribe en su propio `public`. El landing NO tiene variantes PRO
   ni themes → modelo de slot **liviano** (solo `default`).

## Enfoque recomendado (A) — NO aprobado aún

Fuente parametrizada + ruta estática del landing. Tres partes:

- **Leer/catalogar:** concepto `source` (`web` | `landing`) con su `rootDir`. `catalog-server.ts` y
  `asset-triplet.ts` hoy fijan `PUBLIC_DIR = process.cwd()/public` (apps/web); parametrizarlos por `rootDir`
  → `landing` apunta a `apps/landing/public`. Web queda idéntico (`source=web`).
- **Previsualizar:** apps/web no puede servir `/art/…` del landing (otro `public`). Ruta dev
  `GET /api/dev/landing-art/[...path]` que **streamea** `apps/landing/public/art/**` (read-only, gateada por
  `isDevSurfaceEnabled()` → 404 en prod, rechaza `..`). El `<img>` del toggle Landing usa esa URL.
- **Escribir/Undo:** el POST `/api/dev/theme-asset` acepta `source`; resuelve el basename contra un
  **manifiesto del landing** (allowlist), nunca contra el request; escribe en el `rootDir` + trash del landing.
  Reusa `VariantCell` / Replace / Undo tal cual.

**Seguridad (invariante que se mantiene):** el path de escritura se deriva SIEMPRE de un allowlist server-side.
Como el landing no tiene registry, se crea `lib/themes/landing-assets.ts` = manifiesto de los 21 basenames
(agrupados por carpeta = categorías del catálogo) = allowlist + fuente del catálogo.

Descartados: **B** (symlink/rewrite del `public` del landing bajo web — frágil entre entornos, acopla árboles);
**C** (página `/dev/landing-assets` aparte — contradice el toggle elegido).

## Próximos pasos (retomar el brainstorming)

- [ ] Confirmar enfoque A (o explorar B).
- [ ] Presentar el diseño por secciones (tipos del `AssetSource`, manifiesto, ruta de streaming, cambios en
      `catalog-server`/`asset-triplet`/`upload-target`/`page.tsx`, tests).
- [ ] Escribir spec final + plan de implementación (`writing-plans`).

## Relación con el backlog del builder

Esta sección es una extensión del theme-builder. Los otros próximos pasos pedidos por el founder
(localizador `usedIn` ✅ hecho, duplicados por hash, variante PRO por slot, multi-theme, resize) viven en
`docs/handoffs/2026-07-18-theme-builder-catalog-handoff.md`.
