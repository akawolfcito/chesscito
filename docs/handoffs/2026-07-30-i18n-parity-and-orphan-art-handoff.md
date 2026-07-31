# Handoff — paridad i18n + arte huérfano (2026-07-30)

**Estado:** `main` local **5 commits por delante de `origin/main`**, árbol limpio.
**El push es del founder.**

| Commit | Qué |
|---|---|
| `ddd3b83` | 24 claves que mostraban inglés en ES + guard generalizado |
| `0832f79` | el audit que las encontró |
| `c748b3b` | switch LEARN/PLAY a i18n + entierro de `/why` |
| `ddfccdb` | 42 archivos de arte del landing (~19.6 MB) + 12 slots |
| `4270eb8` | `bg-card-og` y `torre-selected` (5 archivos) |

**Verificación:** web **6783 passing / 575 files, EXIT=0** (0 `Unhandled Errors`) ·
landing **58 / 12** · `tsc` limpio en web · `content:audit` exit 0 ·
`audit-theme-runtime-coverage --check` exit 0 · `sync-landing-shared-art --check` sin drift.

Audit completo: `docs/audits/2026-07-30-i18n-and-orphan-art-audit.md`.

---

## Lo que hay que saber para retomar

### 1. El guard de paridad ahora cubre todo el bundle, y su lista de excepciones está VACÍA

`bundle-translation-parity.test.ts` es la generalización de
`challenge-card-es-parity.test.ts`, que sólo miraba `CHALLENGE_CARD_COPY`.

Separa dos cosas a propósito:

- **`IDENTICAL_TOKENS`** — vocabulario que es la misma cadena en los dos idiomas
  (nombres de producto, cadenas de bloques, palabras que el español escribe igual).
  Se compara **contra el copy**, no contra un path de clave: reescribir una frase o
  renombrar una clave no puede dejarlo obsoleto. Es case-insensitive porque el mismo
  nombre aparece `Arena` en una oración y `ARENA` en un botón.
- **`NOT_COPY`** — claves que **no son texto**: rutas de arte (`PIECE_IMAGES`), tokens
  CSS (`HERO_CTA_COPY.*.variant`), un id del DOM (`ariaTitleId`), URLs. Están en el
  bundle sólo porque `en.ts` hace `{ ...editorial }` sin filtrar. **Cada entrada ahí es
  un defecto de forma del bundle, no una decisión de traducción** — el arreglo real es
  sacarlas del bundle (§2.3 del audit, sin hacer).

`EXCUSED` quedó vacío y el comentario dice que así debe seguir: *una entrada nueva es
una promesa de volver*. Preferí borrar o arreglar la causa antes que excusarla.

### 2. Vocabulario cerrado por el founder

**`Daily` → "Diaria"**, no "Diario" (*"suena a periódico o a cuaderno de notas;
diaria me suena más a jerga de juegos"*). Aplica a `HUB_RAIL_COPY.tiles.daily`,
`PEONES_DELTA_COPY.reasons.daily` y `HUB_ACTION_RAIL_COPY.dailyLabel`.
El resto del bundle ya decía "Táctica diaria", así que era un rezagado, no una decisión nueva.

Se quedan en inglés por marca: `PRO`, `Coach`, `Arena`, `Peones`, `Season Pass`,
`Play Kingdom`, `Mate K+R`, `Focus Stamp`.

### 3. ⚠️ El switch LEARN/PLAY y el riel se mueven JUNTOS

`HUB_ACTION_RAIL_COPY.mateLabel` estuvo en inglés a propósito durante un commit: espejaba
una etiqueta **hardcodeada** en `app-mode-switch.tsx`, que no tenía i18n. Los dos nombran
el mismo destino, así que traducir uno solo pone **dos palabras para el mismo lugar en el
mismo hub**. Ahora el switch lee `APP_MODE_SWITCH_COPY` y los dos dicen **"Entrenar"** —
las mismas palabras del switch del slide 4 del landing, que el visitante ve justo antes de
entrar.

### 4. ⚠️ `/why` era un `redirect("/")`, no una página

Reporté primero que `/why` servía español a los visitantes en inglés. **Falso.** La ruta es
un redirect de una línea, y su otro consumidor (`components/landing/landing-page.tsx` en
**web**) no lo importaba nadie: el landing vivo es `apps/landing`, que tiene **su propia**
copia de `WHY_PAGE_COPY` / `LANDING_COPY` y la renderiza desde `/classic`.

De las 30 claves en español dentro del bundle EN, **una sola era alcanzable**:
`ABOUT_COPY.links.why` ("Por qué Chesscito" en el sheet `/about`, en cualquier locale).

Lo borrado en `apps/web`: los dos namespaces, `components/landing/**` (3 archivos), el
`layout.tsx` de `/why` y la superficie `landing-cta-bar` del ribbon.
**El redirect se queda** para enlaces viejos; lo que salió es su fila del `sitemap.ts`
(anunciar un 308 hacia una raíz `noindex` no es una página que valga la pena rastrear).

### 5. ⚠️ Dos formas de que un audit de arte MIENTA, las dos vistas hoy

- **Subcuenta**: `pro-288w` / `pro-384w` parecían huérfanos y **no lo son**. Son las
  variantes responsive de la override PRO de `brand.title` (el wordmark de Chesscito en los
  hubs y el sheet de PRO). El registro nombra la **base** y el resolver deriva los anchos,
  así que **ningún literal dice `pro-288w`**. Un audit por literales no puede verlas.
- **Sobrecuenta**: 9 archivos que conté como huérfanos están en `SHARED_LANDING_ASSETS`.
  El script `art:sync-landing` los espeja a propósito; borrarlos sólo habría hecho que el
  siguiente sync los recreara y que `--check` lo llamara drift.

**Regla práctica: verificar familia por familia antes de borrar arte de `apps/web`.**

### 6. Borrar arte del landing arrastra el registro

Los 12 slots `deprecated` se fueron con sus archivos: un slot que apunta a un archivo
inexistente es peor que no tener slot. Eso movió los conteos pineados **exactamente donde
la memoria decía** — `landing: 31 → 19` en `theme-registry.test.ts`, la enumeración de
`landing-assets.test.ts`, y tres tests que habían elegido un slot ahora muerto como ejemplo
(`upload-target`, `catalog`, y el de la API `/dev/theme-asset`).

---

## Próximo paso acordado

**Dificultades en LEARN** (decisión del founder al cerrar esta sesión). Frentes que siguen
abiertos detrás: juegos lúdicos premium · partidas P2P en PLAY · **Theme Builder**, que
sigue sin spec.

## Abierto

- **~7.5 MB de arte huérfano en `apps/web` sin verificar**: `/scene-rooted` (27 archivos),
  raíz de `/art` (26), `/redesign/avatars` (12) y otros. Pide el mismo ida y vuelta familia
  por familia; el barrido en bloque **no** es seguro (ver §5).
- **Sacar del bundle lo que no es copy** (§2.3 del audit): `PIECE_IMAGES`, los `.variant`,
  `ariaTitleId`. Hoy están nombrados uno por uno en `NOT_COPY`.
- **Guard de literales `/art/` para `apps/landing/src`**: el enforcement de cobertura corre
  sobre las fuentes de **web**. Un `/art/...` nuevo escrito en el landing no pasa por ahí.
  Hoy no hay fuga; nada la impide.
- **Nadie vio renderizado** el hub con "Entrenar"/"Diaria" en 390 px. "Entrenar" es dos
  caracteres más largo que "Training" en la baldosa del riel.
