# Audit — i18n (ES/EN) + arte huérfano · web y landing

**Fecha:** 2026-07-30 · **Base:** `main` @ `825186f4`, árbol limpio
**Método:** heurística del test `challenge-card-es-parity.test.ts` (un valor ES
byte-idéntico al EN *y con letras fuera de los placeholders* = sin traducir),
corrida sobre **todo** el bundle, no sobre un namespace. Arte: cruce de cada
archivo de `public/**` contra todo literal de las fuentes, con extensión y
familia responsive normalizadas, y **verificación por superficie** de cada
bloque grande (el grep solo no alcanza → `feedback_grep_audit_misses_composed_paths`).

---

## 1. El P2 del backlog ya no existe

`offerBenefitTrainings` **está traducido**: `messages/es.ts:1944` →
`"Entrenamientos especiales"`, en el namespace correcto (`CHALLENGE_CARD_COPY`),
y los dos consumidores (`season-pass-sheet.tsx:105`, `hub-tour.tsx:304`) lo leen
por `t()`. Además hay test que lo fija. **El item del backlog está viejo: cerrarlo.**

Lo que sí sigue abierto es la **generalización**: ese test cubre UN namespace.
La misma regla aplicada a todo el bundle destapa lo de abajo.

---

## 2. i18n web — 154 candidatos, triados

De 154, la mayoría es ruido esperado. Lo real se parte en dos direcciones.

### 2.1 🟡 Español dentro del bundle EN (30 claves) — **casi todo es código muerto**

30 claves del bundle EN están escritas en español. La primera lectura fue que
`/why` servía castellano a los visitantes en inglés. **Es falso, y el detalle
cambia la prioridad**: `/why` es un `redirect("/")` de una línea
(`app/[locale]/why/page.tsx`) — la página no renderiza nada.

Rastreado consumidor por consumidor:

| Namespace | Claves | ¿Lo ve alguien? |
|---|---|---|
| `WHY_PAGE_COPY` | 28 | **No.** Sus dos consumidores son (a) el `metadata` de una ruta que 308ea y (b) `components/landing/landing-page.tsx`, que **nadie importa** — el landing real es `apps/landing`, y `/` en web es el Hub |
| `MISSION_RIBBON_COPY.landing-cta-bar` | 1 | **No.** Esa superficie del ribbon solo aparece en su test; sin caller en producción |
| `ABOUT_COPY.links.why` | 1 | **Sí.** Fila del sheet `/about` (`about/page.tsx:20`), rotulada `"Por qué Chesscito"` en cualquier locale, y apuntando a `/`, no a `/why` |

O sea: **una** clave visible, y 29 de copy huérfano. No es un defecto de SEO ni
de producto; es limpieza. Lo que sí queda mal es que `/why` siga en `sitemap.ts:31`
anunciando una URL que redirige.

### 2.2 🟠 ES muestra INGLÉS (~30 claves)

| Namespace | Claves | Nota |
|---|---|---|
| `STREAK_NUDGE_COPY` | 6 (todas) | prosa completa del nudge. Flag apagado hoy → **arreglar antes de prenderlo** |
| `PEONES_DELTA_COPY.reasons.*` | 6 | `Hint`, `Shield`, `Coach`, `Daily`, `Milestone`, `Pack` |
| `HUB_RAIL_COPY.tiles.*` | 6 | `Labyrinth`, `Shop`, `Badges` son traducibles; `Daily`/`PRO` son marca |
| `CHESITO_CARD_COPY` | 3 | `"Your balance to play and unlock"`, `"Top up"` + su aria |
| `NOT_FOUND_PAGE_COPY` | 3 | `"Page not found"`, `"This path does not exist."`, `"Back to Hub"` |
| `WELCOME_PACKAGE_COPY` | 2 | `"Focus Stamp: Day 1"`, `"Welcome Package"` |
| `HUB_TOUR_COPY` | 2 | `"Next"`, `"Got it"` |
| `TRAINING_PATH_COPY.unlockChallengesCta` | 1 | `"Unlock Challenges"` |
| `BOARD_HINT_COPY.selectPieceFirst` | 1 | `"Tap your piece first"` |
| `HUB_ACTION_RAIL_COPY.mateLabel` | 1 | `"Training"` |
| `PLAY_TACTICS_COPY.tileLabel` | 1 | `"Warm-up"` |

### 2.3 ⚪ Falsos positivos — NO tocar (y por qué importa)

Marca (`Chesscito`, `PRO`, `Coach`, `ARENA`, `Peones`, `Season Pass`), URLs,
`CHAIN_NAMES`, `LANGUAGE_CHIP_COPY` (cada idioma en su idioma, a propósito),
formatos puros (`{days}d`, `{score} pts`).

**Pero hay una subclase que no es copy en absoluto y vive en el bundle igual**,
porque `en.ts` hace `{ ...editorial }` sin filtrar:

- `PIECE_IMAGES.*` → **rutas de arte** (`/art/redesign/pieces/w-rook`)
- `HERO_CTA_COPY.*.variant` → tokens de color (`amber`, `blue`)
- `HUB_V2_SPLASH_COPY.ariaTitleId` → un id del DOM (`splash-title`)

Traducibles por accidente. Ninguna herramienta de traducción sabe que no debe
tocarlas.

---

## 3. i18n landing — limpio

`en.ts` / `es.ts` son un solo objeto `onboarding`, y ES está **tipado contra**
`OnboardingMessages`, así que no puede perder forma en silencio (que es
exactamente el defecto estructural del bundle de web). Traducción completa y con
criterio declarado: marca en inglés, el resto español natural.

Dos superficies del landing quedan **solo EN**, y las dos por decisión:
`/stats` (entregable del listing de MiniPay) y `/classic` (sin enlace en la UI).

---

## 4. Arte huérfano

### 4.1 LANDING — 51 archivos, **20.15 MB** (de 171 imágenes)

**Ya está catalogado**: 12 slots `root: "landing"` llevan `deprecated:` con el
motivo escrito. El redesign de slides del 2026-07-29 dejó su generación anterior
en disco.

| Familia | Archivos | Peso | Slot |
|---|---|---|---|
| `chesscito-slide-web-1..4` | 12 | 9.3 MB | `landing.slide-web-1..4` (deprecated) |
| `avatar-*` (4 familias) | 12 | 3.2 MB | `landing.slide{1..4}-avatar` (deprecated: "baked into el bg") |
| `bg-slides`, `bg-slides-web` | 6 | 3.7 MB | `landing.slides-frame`, `landing.slides-scene-desktop` (deprecated) |
| `21-day-challente-title`, `play-chess-title` | 6 | 2.6 MB | superseded por `title-*-{en,es}` |
| `chesscito-title` | 3 | 1.1 MB | **sin slot** — huérfano puro |
| `bg-wallpaper-lite`, `flame-color`, `enter-arena`, `ask-coach-icon` | 12 | 0.55 MB | copias sincronizadas desde web, sin consumidor en landing |

El `.png` es el 90% del peso (hasta 2 MB por archivo) contra `.avif` de ~90 KB.

> Nota: `21-day-challente-title` tiene el typo en el nombre del archivo. Se va con el resto.

### 4.2 WEB — 102 archivos, **8.23 MB** (de 844)

Más disperso y **más delicado**: acá el registro de temas es un referente
legítimo, así que un archivo puede estar vivo sin aparecer en ningún componente.
34 familias, las mayores en `/scene-rooted` (27 archivos), raíz de `/art` (26) y
`/redesign/avatars` (12).

Verificado uno a modo de sonda: `/art/redesign/avatars/player-you.*` **es
huérfano real** — el slot `arena.player-you` resuelve a
`/art/new-icons-chesscito/avatar-blue`, no a esa copia
(patrón de `feedback_a_slot_can_point_at_an_orphan_copy`).

⚠️ **No borrar esta lista en bloque.** Sospechosos de falso positivo que hay que
mirar de a uno: `bg-card-og` (generación de OG), `pro-288w` / `pro-384w`
(variantes responsive que se arman por `srcset`), `torre-selected` (le falta el
`.png` de la familia).

---

## 5. Cobertura de slots en el theme builder

- **web**: 211 slots. Hay enforcement real — `audit-theme-runtime-coverage.mjs`
  falla el build si un literal `/art/...` de las fuentes no es un slot registrado,
  y su lista de excepciones está **vacía a propósito**.
- **landing**: 31 slots `root: "landing"`, y `sync-landing-shared-art.ts --check`
  detecta drift de las copias compartidas.
- **El hueco**: el enforcement corre sobre las fuentes de **web**. Un `/art/...`
  nuevo escrito dentro de `apps/landing/src` **no pasa por ese guard**. Hoy no hay
  fuga (los 31 slots cubren lo que el landing renderiza), pero nada lo sostiene.

---

## 6. Orden propuesto

1. **Generalizar el test de paridad** a todo el bundle con allowlist explícita de
   marca/tokens, y arreglar las ~30 claves de 2.2 con el test en rojo primero.
   Es lo único que hoy se ve mal en pantalla.
2. **Borrar el arte huérfano del landing** (4.1): 20 MB, ya marcado `deprecated`,
   riesgo bajo.
3. **Limpieza de `/why`** (2.1): borrar `WHY_PAGE_COPY`, `landing-page.tsx`, la
   ruta redirect y su fila del `sitemap.ts`. Traducir la única clave viva
   (`ABOUT_COPY.links.why`). Sin usuarios afectados: es código muerto.
4. **Sacar del bundle lo que no es copy** (2.3): `PIECE_IMAGES`, `.variant`, `ariaTitleId`.
5. **Guard de literales `/art/` para `apps/landing/src`** (5) — barato, cierra el hueco.
6. **Web (4.2)**: verificación por familia antes de borrar. El más caro y el que menos rinde.

## Preguntas abiertas

- `HUB_RAIL_COPY.tiles.daily` = `"Daily"`: ¿es marca (como `PRO`) o se traduce
  a "Diaria"? La respuesta fija también `PEONES_DELTA_COPY.reasons.daily`.
- `/why` + `landing-page.tsx`: ¿se borran o se conservan como material para una
  landing futura? Hoy no los alcanza nadie.
- Arte huérfano de web: ¿se borra o se deja? 8 MB no molestan a nadie en runtime.
