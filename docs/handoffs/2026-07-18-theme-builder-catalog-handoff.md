# Handoff — Theme-builder art catalog (feat/theme-builder → main)

**Fecha:** 2026-07-18 · **Estado:** completo, mergeado a `main` (25 commits).

## Qué se construyó
Una pantalla dev **`/dev/theme-builder`** que es el catálogo de arte del app: lista **162 slots**
en ~18 categorías (hub, board, exercises, arena, shared, brand, coach, account, pro-sheet, scene,
bg, shop, daily, peones, hud, victory, welcome, landing, pro-mission, tactics). Por cada slot:
default vs pro lado a lado, dimensiones reales (sharp), `usedIn`, y **Replace image** que genera el
triplet PNG/WebP/AVIF **optimizado** in-process + **Undo** (backup 1 nivel) + **copy path**.

**Modelos que quedaron (validados en código):**
- Variante PRO = `isPro ? pro : default` en el mismo slot (portal, avatar, avatar-lite, pro-chip).
- **PRO-only overlay** = slot con `default` AUSENTE + `pro` = la decoración (`pro && <img>`), catálogo
  muestra "free: none" (bordes dorados `arena.avatar-frame-*`).
- **Deprecated** = badge ámbar para assets que no deberían usarse (`hub.mastery.piece.*`, `board.legacy-bg`).
- `pro-sheet.*` = superficie de suscripción (contenido, NO capa PRO variante).
- **Un slot = un archivo**: mismo archivo en N pantallas → un slot con `usedIn` múltiple.

**Gates:** `/dev/*` vivo local+preview, 404 prod. Upload es **local-only** (FS de Vercel read-only).

## Método (importante para mantener)
El detector de gap CONFIABLE es el **literal-diff**: `comm -23` entre todos los `/art/…` literales del
código y los basenames registrados, filtrado a los que existen en disco. El barrido por-superficie
categoriza pero NO mide cobertura (se le escapan carpetas no visitadas + selección dinámica). Correr
el literal-diff antes de dar el catálogo por completo. Ver `[[feedback_grep_audit_misses_composed_paths]]`.

## Próximos pasos pedidos por el founder (NO hechos)

1. **Localizador preciso de uso** — hoy `usedIn` es descriptivo ("Kingdom scene"). El founder necesita
   saber la **pantalla/modal/componente exacto** para ir a validar visualmente (ej. `pedestal-play`
   solo aparece en CSS, no sabe dónde se ve). *Idea:* poblar `usedIn` con el path del componente
   consumidor (derivable por grep), o un botón que abra la ruta. Esfuerzo medio (162 slots).

2. **Detectar/mergear íconos duplicados** — varios assets son el MISMO arte en rutas distintas
   (`hub/enter-arena` ≈ `redesign/banners/btn-battle` ≈ `btn-play`). *Idea:* hash de archivo por slot;
   el catálogo agrupa/avisa los byte-idénticos y ofrece consolidar a uno. Esfuerzo medio.

3. **Agregar variante PRO desde el catálogo** — hoy subir un `pro` requiere declararlo antes en el
   registry. El founder quiere que **cualquier slot** pueda recibir un asset PRO propio cuando quiera
   (y si no tiene, cae a default). *Idea:* el upload a la celda PRO crea la variante (escribe el
   registry o un overlay de datos). Esfuerzo medio. Es la "independencia PRO por slot".

4. **Multi-theme: consolidar + crear + cambiar (MAYOR esfuerzo)** — empaquetar todo el theme actual,
   crear nuevos, y switchear fácil. Es la Fase C/D de la foundation: migrar el registry a
   **data-driven** (array de slots con override parcial, en vez del union de tipos que exige que cada
   theme implemente los 162 keys), `useActiveTheme` desde localStorage, picker en AccountSheet, y
   monetización. Ver `[[project_theme_system_foundation]]`. Aquí es donde el "un solo theme" deja de
   escalar y conviene el refactor.

5. **Half B (resize)** — optimización con resize a dimensión ideal por slot; diferido hasta definir ideales.

## Verificación
Suite themes 33/33, themes+kingdom 82/82, typecheck limpio, 0 archivos faltantes en el catálogo.
Gap del literal-diff = 0 (todo `/art` en disco está registrado).
