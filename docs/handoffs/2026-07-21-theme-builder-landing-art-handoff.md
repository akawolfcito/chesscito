# Handoff — Landing art en el theme-builder (2026-07-21)

**Branch:** `feat/theme-builder-landing-art` (9 commits, pusheada, sin mergear)
**Plan:** `docs/superpowers/plans/2026-07-21-landing-art-in-theme-builder-plan.md`
**Alcance aprobado por el founder:** Fase 1 + Fase 2; slides muertos como `deprecated`.

---

## Qué quedó funcionando

Las **15 imágenes del carrusel del landing** ya son reemplazables desde
`/dev/theme-builder`, y el reemplazo llega al archivo real que sirve
`apps/landing` en producción.

### 🐞 Bug que se arregló de paso

Los 3 slots `landing.*` que ya existían (`landing.hero`, `landing.pre-chess`,
`landing.progress-trophies`) apuntaban a **copias huérfanas dentro de
`apps/web/public` que ningún componente renderiza**. Reemplazarlos en el builder
no cambiaba nada en producción. Estaban clasificados `unknown` justamente porque
el audit no les encontraba consumidor — la señal estaba, mal leída.
`hero-play-hub` ya había divergido byte a byte entre las dos apps.

### Cómo se resolvió

`ThemeAssetEntry.root?: "web" | "landing"` — ausente = `web`, así que los otros
159 slots no se tocan. **Ningún consumidor de runtime lee `root`**: Season Pass,
PRO, `useThemeAsset` y las entitlements se comportan exactamente igual.

La capa de escritura (`asset-triplet.ts`) ya aceptaba `rootDir` en todo el
camino; solo el resolver del catálogo hardcodeaba `process.cwd()`. Eso hizo la
Fase 1 mucho más barata de lo esperado.

| Pieza | Archivo |
|---|---|
| Whitelist cerrada de raíces | `apps/web/src/lib/themes/asset-roots.ts` |
| 18 slots `landing.*` | `theme-registry.ts` (+ superficie `landing`) |
| Resolver por-slot | `catalog-server.ts` |
| Preview (el dev server de web no sirve `apps/landing/public`) | `GET /api/dev/theme-asset` |
| Escritura enraizada | `POST /api/dev/theme-asset` |
| Badge `apps/landing` en la UI | `app/dev/theme-builder/page.tsx` |
| Manifiesto de arte compartido | `shared-landing-assets.ts` (25 basenames) |
| Sync web→landing | `pnpm art:sync-landing` / `:check` |

### Fase 2 — arte compartido

25 basenames se renderizan en **las dos apps** y por eso existen dos veces en
disco. No se duplicaron slots (violaría "un slot = un archivo"): la copia de web
sigue siendo el único slot y el script propaga al landing.

La familia `CandyIcon` entró **por nombre**, no por grep: el landing compone
`/art/redesign/icons/${name}` en runtime, así que un audit por literales
reportaría esos 19 iconos como no usados. Es el mismo modo de falla que
[[feedback_grep_audit_misses_composed_paths]].

Se corrió el sync una vez: `fingerprint` y `star` ya habían divergido. **Comparé
las dos versiones visualmente antes de sobrescribir** — mismo arte, re-encode,
sin cambio visual en el landing.

---

## Verificación

- `apps/web`: **5605 passing / 495 files**, exit 0 (no solo los conteos —
  [[feedback_green_suite_can_still_fail_the_job]]).
- `apps/landing`: 36 passing / 8 files. `tsc --noEmit` limpio en ambas apps.
- `pnpm theme:coverage` verde.
- **Smoke real contra `next dev`**: `/dev/theme-builder` → 200 con los 18 slots
  `landing.*` renderizados y su badge; el preview de `landing.slide1-avatar` →
  200 `image/png`, 2.2 MB, servido desde `apps/landing/public`.

El audit de runtime ahora se limita a los slots que el app web posee (159):
escanea `apps/web/src`, así que un slot del landing le leería como un hueco que
no existe. `landing-assets.test.ts` cubre la otra mitad — toda imagen que el
landing renderiza está en el catálogo o en el manifiesto, y ninguna deriva.

---

---

## Segunda tanda — huecos que encontró el founder mirando el builder

Los tres salieron del mismo antipatrón: un asset con arte y consumidor reales,
pero **sin slot**, tapado por un fallback hardcodeado o por la lista de
excepciones del audit. Una entrada en `ALLOWED_UNREGISTERED_LITERALS` es, por
definición, un asset que nadie puede reemplazar desde el builder. **La lista
quedó vacía** y el audit reporta literal-diff 0.

| Asset | Cómo estaba tapado | Fix |
|---|---|---|
| `/art/rivals/mara-avatar` | `if (avatarSlot) … else <picture>` en `arena-select-scaffold` | slot `arena.rival-mara`; `Rival.avatarSlot` ahora **obligatorio** |
| `/art/shop/pro` | `icon` string crudo en `SHOP_TILE_ASSETS` | slot `shop.pro`; `iconSlot` ahora **obligatorio** |
| `/art/redesign/icons/close` | ruta compuesta por `CandyIcon`, invisible al grep | slot `shared.close-candy` |

En los dos primeros el campo pasó a **obligatorio**: el próximo rival o tile que
se agregue sin slot es error de compilación, no un fallback silencioso.

### ⚠️ Hallazgo colateral — el guard que no existía

Catalogar a Mara **bajó** la suite de 5605 a 5603. `asset-integrity.test.ts`
genera un test por literal `/art/…` hardcodeado, así que borrar el `<picture>`
se llevó sus 3 chequeos de existencia. El problema de fondo: ese scanner **no ve
los slots del catálogo** (basename sin extensión, resuelto en runtime). O sea
**cada superficie que migró a `useThemeAsset` perdió su chequeo de que el
archivo existe** — ~150 slots sin garantía. Ninguno roto hoy; un typo en un
basename habría shippeado una imagen en blanco con la suite verde.
Cubierto por `catalog-assets-on-disk.test.ts`.

### UI — el basename se cortaba al revés

`truncate` corta la **cola**, que es lo único que nombra al asset: los 18 slots
del landing se leían todos `/art/landing-slides/avat…`. Por eso el founder buscó
`avatar-play-chess`, no lo encontró y concluyó que el slot faltaba. Ahora muestra
los últimos dos segmentos; el path completo sigue en el tooltip y en el copy.

## Próximos pasos

0. **Correr la suite completa una vez.** La última corrida entera fue en
   `1e6baa0` (5606 passing / 496 files, exit 0). Lo de después (`shop.pro`,
   `shared.close-candy`, truncate) se validó con los 22 archivos afectados
   (159 passing, exit 0) + `tsc --noEmit` limpio, no con la suite entera.
1. **Mergear la branch** (no está mergeada; no hay PR abierto todavía).
2. **Probar un reemplazo real** en `/dev/theme-builder` sobre un slide y mirar
   el landing local — es la única parte que no ejercité con un upload de verdad
   (los tests mockean la transacción de archivos).
3. Correr `pnpm art:sync-landing` después de reemplazar cualquier asset
   compartido. El test falla si alguien lo olvida.

## Open questions

- **Copias huérfanas en `apps/web/public/art/landing/*`** (3 basenames, 9
  archivos): ya no las lee nadie. Borrarlas es un cambio destructivo aparte —
  no lo hice. ¿Se borran?
- **24 basenames duplicados en `apps/landing/public` que el landing no usa**
  (incluido `redesign/icons/streak`, que además divergió). Fuera del manifiesto
  a propósito. Misma pregunta.
- Los 4 `landing.slide-web-*` quedaron cataloged + `deprecated`. Si el carrusel
  desktop se va a construir, dejan de ser deprecados; si no, son candidatos a
  borrado.
