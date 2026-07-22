# Theme builder — OG image + brand icons derivados

**Fecha:** 2026-07-22
**Estado:** aceptado, sin implementar
**Superficie:** `/dev/theme-builder`, `apps/landing/public`, `apps/web/src/app`

## Problema

Tres archivos de marca no son alcanzables desde el theme builder:

| archivo | formato | hoy |
|---|---|---|
| `apps/landing/public/og/chesscito-landing.jpg` | JPG 1200×630 | se edita a mano |
| `apps/landing/public/apple-icon.png` | PNG 180×180 | se edita a mano |
| `apps/landing/public/favicon.ico` | ICO | se edita a mano |

Dos causas:

1. **La pipeline es un triplete cerrado.** `CANONICAL_EXTENSIONS = ["png","webp","avif"]`
   (`asset-triplet.ts:20`) y `TRIPLET_EXTENSIONS` (`catalog.ts:25`) son la lista universal.
   Un `.jpg` y un `.ico` no tienen forma de existir como slot.
2. **No hay noción de asset derivado.** `favicon.ico` y `apple-icon.png` no son arte
   independiente: son recortes del wolf mark. Hoy nada lo expresa, así que divergen.

**El drift ya ocurrió.** Verificado en disco (2026-07-22):
`apps/landing/public/favicon.ico` y `apps/web/src/app/favicon.ico` son idénticos
(md5 `2b46def3…`), pero los dos `apple-icon.png` **ya divergieron**
(`56683e7b…` vs `b185ce99…`). Nadie lo reportó.

## Decisiones tomadas

1. **Un master, derivados read-only.** `brand.favicon` (`/art/favicon-wolf`, 1254×1254,
   root `web`) es la única fuente editable. `apple-icon` y `favicon.ico` se derivan.
2. **Alcance: landing + web.** El script escribe los 5 destinos, corrigiendo el drift
   existente. El builder cataloga solo los 2 de landing — los de web viven en
   `src/app/` (convención de Next), fuera de `public/`, donde el resolver no llega.
3. **Trigger doble.** Replace en el builder → deriva; más `pnpm icons:generate` y
   `--check` para CI.
4. **Write-then-derive con reporte.** Si la derivación falla tras un Replace exitoso,
   el master queda escrito y el response lo dice. No se revierte. Mismo patrón que
   shields (write-then-notify), y `icons:generate` permite reintentar.

## Diseño

### 1. `format` — slots de archivo único

`ThemeAssetEntry` gana un campo opcional en `theme-registry.ts`:

```ts
/** Slot que NO es un triplete: un único archivo con esta extensión fija.
 *  Ausente = triplete PNG/WebP/AVIF (el default histórico de ~165 slots). */
format?: SingleFileFormat; // "jpg" | "ico" | "png"
```

Consecuencias, todas gateadas por la ausencia del campo (cero cambio para los slots
existentes):

- **`catalog.ts`** — `AssetResolver` recibe `format` en su `context`. El
  `fsAssetResolver` probe **solo** esa extensión en vez de iterar `TRIPLET_EXTENSIONS`.
  `AssetFormat` se amplía a `png|webp|avif|jpg|ico`.
- **`asset-triplet.ts`** — `replaceAssetFamilyAtomic` acepta `format` en
  `ReplaceOptions`. Con `format` presente escribe **un** miembro con esa extensión;
  sin él, el triplete de siempre. El lock, el backup y el undo no cambian: ya operan
  sobre una lista de miembros.
- **Dimensiones** — `landing.og-image` declara 1200×630 exactos. Un upload de otro
  tamaño se rechaza con `validation-failed`. (El OG se rompe silenciosamente si no
  respeta la relación; validarlo es más barato que descubrirlo en Twitter.)
- **ICO no pasa por sharp al escribir.** `sharp` no encodea ICO. Un slot con
  `format: "ico"` no es uploadeable directamente — solo llega ahí por derivación.
  El validador de dimensiones lo saltea.

### 2. `derivedFrom` — slots read-only

```ts
/** Este slot se genera desde otro; no se edita solo. */
derivedFrom?: ThemeAssetKey;
```

- `SlotCatalogEntry` propaga `derivedFrom` al cliente.
- La UI (`page.tsx`) oculta Replace/Undo y muestra el badge
  `derivado de brand.favicon`.
- **`/api/dev/theme-asset` rechaza con 400** cualquier POST a un slot con
  `derivedFrom`. El contrato se cierra en el servidor: la UI es conveniencia, no
  la barrera.

### 3. Slots nuevos en el registry

```ts
"landing.og-image": {
  root: "landing", format: "jpg",
  default: "/og/chesscito-landing",
  usedIn: ["Landing — Open Graph / Twitter card",
           "↳ apps/landing · src/app/layout.tsx (openGraph.images, twitter.images)"],
},
"brand.apple-icon": {
  root: "landing", format: "png", derivedFrom: "brand.favicon",
  default: "/apple-icon",
  usedIn: ["Landing — apple touch icon", "↳ apps/landing · src/app/layout.tsx (icons.apple)"],
},
"brand.favicon-ico": {
  root: "landing", format: "ico", derivedFrom: "brand.favicon",
  default: "/favicon",
  usedIn: ["Landing — browser favicon", "↳ apps/landing · src/app/layout.tsx (icons.icon)"],
},
```

Los tres se agregan también a `ThemeAssetKey`, a `THEME_SLOT_SURFACES` y al orden de
display.

### 4. `ico-encoder.ts` — sin dependencia nueva

Un `.ico` es un contenedor: `ICONDIR` (6 bytes) + N × `ICONDIRENTRY` (16 bytes) +
los payloads PNG concatenados. Sharp produce los PNG; el header se arma a mano.

```ts
export function encodeIco(images: { size: number; png: Buffer }[]): Buffer;
```

Detalles del formato que el test debe fijar:
- `ICONDIR`: reserved `0`, type `1` (icon), count `N` — todo little-endian.
- `ICONDIRENTRY.width/height`: **1 byte cada uno, y `256` se codifica como `0`**.
  Con 16/32/48 no aplica, pero el encoder lo maneja igual.
- `bytesInRes` = largo del PNG; `imageOffset` = 6 + 16·N + suma de los anteriores.
- Entradas ordenadas por tamaño ascendente.

Módulo puro: buffers entran, buffer sale. Sin fs, sin sharp.

### 5. `icon-derivation.ts` — la tabla de destinos

```ts
export type DerivedIcon = {
  root: AppRoot;
  /** Relativo a la raíz de la app — NO siempre bajo public/. */
  relativePath: string;
  buffer: Buffer;
};

export async function deriveBrandIcons(source: Buffer): Promise<DerivedIcon[]>;
```

| destino | root | contenido |
|---|---|---|
| `public/favicon.ico` | landing | ICO 16+32+48 |
| `public/apple-icon.png` | landing | PNG 180×180 |
| `src/app/favicon.ico` | web | ICO 16+32+48 |
| `src/app/apple-icon.png` | web | PNG 180×180 |
| `src/app/icon.png` | web | PNG 192×192 |

**Contrato de seguridad.** La tabla es una constante del módulo. Ningún destino se
deriva de un request: el caller solo aporta el buffer fuente. Esto extiende
`asset-roots.ts` a paths fuera de `public/`, así que la escritura valida que el
destino resuelto siga dentro de la raíz de su app antes de escribir.

Redimensionado con `fit: "contain"` y fondo transparente, para no recortar el wolf
si la fuente deja de ser cuadrada.

### 6. Enganche en el Replace

En `api/dev/theme-asset/route.ts`, **después** de que `replaceAssetFamilyAtomic`
devuelve OK, y solo si `key === "brand.favicon" && typedVariant === "default"`:

```ts
const derived = await deriveAndWriteBrandIcons(buffer).catch(toReport);
return NextResponse.json({ ok: true, basename, ...result, derived });
```

`derived` es `{ ok: true, files: string[] }` o `{ ok: false, error: string }`. La UI
muestra el error como warning junto al Replace exitoso, con el comando de reintento.
El `pro` de un tema **no** dispara derivación: el favicon del browser es marca, no tema.

### 7. Script

`apps/web/scripts/generate-brand-icons.ts`, calcado de `sync-landing-shared-art.ts`:

- `pnpm icons:generate` — escribe los 5, imprime JSON con lo que cambió.
- `pnpm icons:generate --check` — reporta drift, `exit 1`, no escribe. Para CI.

Fuente: `apps/web/public/art/favicon-wolf.png`. Si falta, exit 1 con mensaje claro.

## Tests

| archivo | qué fija |
|---|---|
| `ico-encoder.test.ts` | header, count, offsets acumulados, orden, 256→0 |
| `icon-derivation.test.ts` | 5 destinos exactos, dimensiones exactas, ICO decodificable |
| `catalog.test.ts` | slot con `format` resuelve una sola extensión; `derivedFrom` viaja al cliente |
| `asset-triplet` tests | `format` escribe un miembro; sin `format`, triplete intacto |
| `route.test.ts` | POST a slot derivado → 400; replace de `brand.favicon` default → `derived.ok`; fallo de derivación → `ok:true` + `derived.ok:false` |
| `generate-brand-icons` | `--check` detecta drift y no escribe |

Los slots nuevos deben pasar los tests de cobertura del registry ya existentes
(`runtime-coverage.test.ts`, `catalog.test.ts`) sin excepciones especiales.

## Fuera de alcance

- `apps/web/public/icon-512.{png,webp,avif}` — ya es slot del builder y su fuente no
  está confirmada como el wolf. Tocarlo pide su propia verificación.
- Hacer los iconos de `apps/web/src/app` catalogables. Requiere que el resolver salga
  de `public/`, que es un cambio al contrato de `asset-roots.ts` más grande que esto.
- Generar el OG image desde una plantilla. Sigue siendo un JPG que se sube a mano.

## Preguntas abiertas

Ninguna. Las cuatro decisiones de arriba están cerradas.
