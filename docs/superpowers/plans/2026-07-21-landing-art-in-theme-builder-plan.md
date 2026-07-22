# Plan — Landing art (slides) en el theme-builder

**Fecha:** 2026-07-21 · **Estado:** propuesto, pendiente de aprobación
**Objetivo:** que `/dev/theme-builder` pueda reemplazar las imágenes del carrusel de
`apps/landing`, sin romper los 162 slots actuales ni la lógica de Season Pass / PRO.

---

## 1. Hallazgos (verificados contra el código, no supuestos)

### 1.1 LEARN y PLAY ya están cubiertos
El catálogo tiene **162 slots** con cobertura literal completa de `apps/web`
(`scripts/audit-theme-runtime-coverage.mjs --check` + `runtime-coverage.test.ts`).
**El único hueco real es LANDING**, que es una app aparte con su propio `public/`.

### 1.2 🐞 Bug latente: los 3 slots `landing.*` que ya existen NO tocan el landing
`theme-registry.ts` ya declara:

| slot | apunta a | quién lo renderiza |
|---|---|---|
| `landing.hero` | `/art/landing/hero-play-hub` | **nadie en `apps/web`** |
| `landing.pre-chess` | `/art/landing/pre-chess-exercise` | **nadie en `apps/web`** |
| `landing.progress-trophies` | `/art/landing/progress-trophies` | **nadie en `apps/web`** |

Los renderiza `apps/landing/src/components/landing/landing-page.tsx`, que lee
`apps/landing/public/art/landing/*` — **otro archivo**. Están clasificados `unknown`
justamente porque el audit no les encuentra consumidor en web.
→ Hoy reemplazar `landing.hero` en el builder **no cambia nada en producción**.
Y `hero-play-hub` **ya divergió**: los dos archivos son distintos byte a byte.

### 1.3 Inventario de arte del landing (135 archivos = 45 basenames)

- **15 basenames landing-only** → todo `/art/landing-slides/*`. Nadie más los tiene.
- **30 basenames duplicados** con `apps/web/public` en la **ruta idéntica**.
  26 son byte-idénticos; **4 ya divergieron**: `landing/hero-play-hub`,
  `redesign/icons/{fingerprint,star,streak}`.
- De esos 30, el landing solo **usa** 9: `bg-wallpaper-lite`, `hub/train-pieces`,
  `redesign/banners/btn-battle`, `focus-passport/flame-color`, `new-icons-chesscito/save`,
  `new-assets-chesscito/btns/ask-coach-icon`, `landing/{hero-play-hub,pre-chess-exercise,progress-trophies}`.
- **4 basenames muertos**: `landing-slides/chesscito-slide-web-{1,2,3,4}` — están en disco,
  no los referencia nadie en todo el monorepo.

### 1.4 La capa de escritura YA es root-agnóstica
`asset-triplet.ts` acepta `rootDir` en todo el camino (`replaceAssetFamilyAtomic`,
`restorePreviousAssetFamilyAtomic`, `hasBackup`, `withFamilyLock`, `roots()`).
Solo está **hardcodeado el `process.cwd()`** en `catalog-server.ts:18` y en la ruta
de upload, que nunca pasan `rootDir`. Eso baja mucho el costo.

---

## 2. Diseño propuesto

### Invariante que se conserva
**Un slot = un archivo único.** Un slot nuevo solo existe cuando el arte vive
*únicamente* en el landing. El arte compartido sigue teniendo **un solo slot** (el de web);
lo que se agrega es un sync, no un slot duplicado.

### Fase 1 — Slots con raíz de app (el pedido: slides del carrusel)

1. **`ThemeAssetEntry.root?: "web" | "landing"`** (default `"web"`).
   Campo aditivo y documental-para-el-writer: ningún consumidor de runtime lo lee, así
   que Season Pass, PRO, `useThemeAsset` y los 162 slots quedan intactos.
2. **`lib/themes/asset-roots.ts`** — `resolveAppRoot(root)` → `process.cwd()` para web,
   `path.join(process.cwd(), "../landing")` para landing. Whitelist cerrada.
3. **`catalog-server.ts`** — resolver el `PUBLIC_DIR` por slot en vez de una constante.
4. **Preview** — `GET /api/dev/theme-asset` (dev-only, misma compuerta `isDevSurfaceEnabled`)
   que recibe `(themeId, key, variant)` y streamea el archivo desde la raíz que declara
   el registry. **Nunca** una ruta del cliente — mismo contrato de seguridad que el POST.
   El `<img>` del catálogo usa esa URL solo para slots con `root !== "web"`.
5. **`route.ts` (POST)** — pasar `rootDir` a replace / restore / hasBackup.
6. **Registrar 15 slots `landing.*`** (`root: "landing"`): 4 avatares, 3 títulos,
   `bg-slides`, `bg-slides-web`, `season-pass-icon`, `pro-suscription-icon`,
   y los 4 `chesscito-slide-web-*` marcados `deprecated: "sin consumidor"`.
7. **Retargetear los 3 slots `landing.*` existentes** a `root: "landing"` (arregla 1.2).
8. **Audit script** — ignorar los slots con `root !== "web"` al construir el inventario
   de runtime de web. Así `totalSlots` sigue en 162 y `runtime-coverage.test.ts` no cambia.
   Los slots del landing se validan con su propio test (existencia del triplete en disco).

**Resultado:** las 15 imágenes del carrusel + las 3 del landing-page se reemplazan desde
`/dev/theme-builder` y **sí** llegan a producción.

### Fase 2 — Arte compartido (opcional, chico)

`scripts/sync-shared-art.mjs`: copia los 9 basenames compartidos de
`apps/web/public` → `apps/landing/public` y falla si detecta drift no declarado.
Se corre a mano o como `prebuild` del landing. Elimina de raíz la clase de bug de 1.3
(4 archivos ya divergidos) **sin** crear slots duplicados.

---

## 3. Lo que NO se toca

- `useThemeAsset`, `use-effective-theme-tier`, entitlements, Season Pass, PRO.
- Los 162 slots existentes (salvo el `root` de los 3 `landing.*`).
- `apps/landing/src` — sigue leyendo rutas hardcodeadas; el builder escribe el archivo real.
- Ningún borrado de archivos. Las copias huérfanas de `apps/web/public/art/landing/*`
  quedan donde están; proponer su borrado aparte, con confirmación.

## 4. Riesgos

| Riesgo | Mitigación |
|---|---|
| `runtime-coverage.test.ts` pinnea 162 slots | El audit filtra por `root`; el número no cambia |
| El preview del catálogo 404ea para slots del landing | Ruta GET dev-only dedicada (paso 4) |
| Un `root` nuevo abre escritura arbitraria | Whitelist cerrada de 2 raíces, derivada del registry |
| Escribir en `apps/landing` en Vercel | Ya bloqueado por `canWriteBaseline()` (Save es local-only) |

## 5. Orden de ejecución (TDD)

1. Tipo `root` + `asset-roots.ts` + test de resolución de raíz (rojo → verde).
2. `catalog-server` por-slot + test con resolver falso.
3. Ruta GET de preview + test (404 en prod, refuse de slot desconocido).
4. POST con `rootDir` + test.
5. Registrar los 18 slots + test de existencia en disco.
6. Audit script filtra por `root`; suite completa verde.
7. (Fase 2) script de sync + test.
