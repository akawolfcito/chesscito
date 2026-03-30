# Asset Production Inventory — Chesscito Visual Upgrade

> Inventario completo de assets actuales + assets necesarios para alcanzar UI premium "game level".
> Para cada asset nuevo: nombre, descripcion, prompt para ChatGPT (DALL-E) y Leonardo AI.

---

## 1. Backgrounds

### 1.1 Play Hub Background (P0)
- **Archivo actual**: `bg-chesscitov3.{png,webp,avif}`
- **Usado en**: globals.css `--playhub-game-bg`, Play Hub main screen
- **Estado**: Necesita reemplazo completo
- **Formato output**: PNG 1170x2532 (3x mobile) + WebP < 300KB + AVIF

**ChatGPT (DALL-E):**
```
Fantasy medieval chess sanctuary interior at night. Warm candlelight
and soft magical teal glow illuminate stone arches and ancient wooden
shelves. Deep navy blue atmosphere with amber light pools. Painterly
digital art style, vertical mobile game background, 9:19.5 aspect
ratio. Rich but not busy, slightly out of focus for depth of field.
No characters, no text, no UI elements. Dark atmospheric mood.
```

**Leonardo AI:**
```
Fantasy chess sanctuary interior, medieval stone architecture, night
scene, warm candlelight, soft teal magical glow, arched ceilings,
ancient wooden furniture, deep navy blue and warm amber color palette,
painterly digital art, atmospheric fog, depth of field blur, vertical
composition 9:19.5 aspect ratio, game UI background asset, no
characters, no text, dark mood
```

---

### 1.2 Arena Background (P1)
- **Archivo actual**: Reutiliza `bg-chesscitov3` con overlay
- **Usado en**: Arena screen (`/arena`)
- **Estado**: Necesita asset propio para diferenciarse del Play Hub
- **Formato output**: PNG 1170x2532 + WebP < 300KB + AVIF

**ChatGPT (DALL-E):**
```
Fantasy medieval colosseum arena at night, stone pillars with burning
torches, magical blue flames and teal energy, chess-themed battle
ground with carved stone floor, dark dramatic lighting, deep navy
and teal tones with amber torch highlights. Painterly digital game
art style, vertical mobile background 9:19.5 aspect ratio.
Atmospheric fog, intense but subordinate mood. No characters, no
text, no UI elements.
```

**Leonardo AI:**
```
Medieval fantasy colosseum arena, night scene, stone pillars, burning
torches, magical teal flames, chess battle ground, carved stone floor,
dramatic lighting, deep navy and teal palette, amber torch highlights,
painterly game art, vertical mobile background 9:19.5 ratio,
atmospheric fog, no characters, no text, dark intense mood
```

---

### 1.3 Splash / Onboarding Background (P2)
- **Archivo actual**: `bg-splash-chesscito.{png,webp,avif}`
- **Usado en**: globals.css `--intro-bg-mobile`, intro overlay
- **Estado**: Evaluar si el actual funciona con el nuevo lenguaje visual

**ChatGPT (DALL-E):**
```
Fantasy chess kingdom entrance gate at twilight, massive ornate stone
archway with chess piece carvings, warm golden light emanating from
within, deep navy blue twilight sky with stars, magical teal particles
floating. Painterly digital game art, vertical mobile 9:19.5 ratio.
Inviting and mysterious, depth of field. No characters, no text.
```

**Leonardo AI:**
```
Fantasy chess kingdom entrance gate, twilight scene, ornate stone
archway, chess piece carvings, warm golden interior light, navy
twilight sky with stars, teal magic particles, painterly game art,
vertical mobile background 9:19.5 ratio, inviting mysterious mood,
depth of field, no characters, no text
```

---

### 1.4 Leaderboard Sheet Background (P2)
- **Archivo actual**: `leaderboard-hall-chesscito.{png,webp,avif}`
- **Usado en**: `.sheet-bg-leaderboard::before`
- **Estado**: Evaluar tras upgrade de backgrounds principales

**ChatGPT (DALL-E):**
```
Fantasy hall of champions interior, tall stone columns with golden
plaques, warm torch lighting, trophies and chess pieces displayed on
pedestals, deep navy atmosphere with amber highlights. Painterly game
art style, vertical mobile format 9:19.5 ratio, slightly blurred
for UI overlay use. No characters, no text.
```

**Leonardo AI:**
```
Fantasy hall of champions, stone columns, golden plaques, warm torch
lighting, trophies on pedestals, chess piece displays, navy
atmosphere, amber highlights, painterly game art, vertical mobile
9:19.5 ratio, blurred background for UI, no characters, no text
```

---

### 1.5 Shop Sheet Background (P2)
- **Archivo actual**: `shop-magic-chesscito.{png,webp,avif}`
- **Usado en**: `.sheet-bg-shop::before`

**ChatGPT (DALL-E):**
```
Fantasy magical item shop interior, wooden shelves with glowing
potions and enchanted chess pieces, warm amber candlelight, mystical
purple and teal accents, medieval alchemy workshop feel. Painterly
game art, vertical mobile 9:19.5 ratio, blurred for UI overlay.
No characters, no text, cozy atmospheric mood.
```

**Leonardo AI:**
```
Fantasy magical shop interior, wooden shelves, glowing potions,
enchanted chess pieces, warm candlelight, purple and teal accents,
medieval alchemy workshop, painterly game art, vertical 9:19.5 ratio,
blurred background, no characters, no text, cozy atmosphere
```

---

### 1.6 Badges Sheet Background (P2)
- **Archivo actual**: `bg-badges-chesscito.{png,webp,avif}`
- **Usado en**: `.sheet-bg-badges::before`

**ChatGPT (DALL-E):**
```
Fantasy trophy vault interior, glass display cases with glowing
badges and medals on velvet cushions, warm amber spotlights, deep
navy background with golden reflections, medieval museum feel.
Painterly game art, vertical mobile 9:19.5 ratio, blurred for UI
overlay. No characters, no text.
```

**Leonardo AI:**
```
Fantasy trophy vault, glass display cases, glowing badges and medals,
velvet cushions, amber spotlights, navy background, golden
reflections, medieval museum, painterly game art, vertical 9:19.5
ratio, blurred background, no characters, no text
```

---

## 2. Dock / Navigation Icons

> Actualmente son PNGs planos con filtros CSS. Necesitan reemplazo por iconos ilustrados con profundidad, shading y estilo de juego consistente.

### Estilo target
Iconos 3D-ish con shading, highlights, y dimensionalidad. Como los iconos de Clash Royale (monedas de oro, gotas de elixir, gemas). No flat, no glyph — mini ilustraciones.

### 2.1 Badge / Trophy Icon
- **Archivo actual**: `badge-menu.{png,webp}`
- **Usado en**: Dock position 1 (badge sheet trigger)

**ChatGPT (DALL-E):**
```
Game UI icon of a golden trophy with chess knight emblem, 3D rendered
with metallic shading and highlights, warm gold and amber tones,
subtle glow effect, dark transparent background, 256x256 pixels,
fantasy game style, clean edges suitable for small display.
```

**Leonardo AI:**
```
Game UI trophy icon, golden metallic, chess knight emblem, 3D shading,
warm gold highlights, subtle glow, transparent dark background,
256x256, fantasy game icon style, clean edges, small display ready
```

---

### 2.2 Shop Icon
- **Archivo actual**: `shop-menu.{png,webp}`
- **Usado en**: Dock position 2 (shop sheet trigger)

**ChatGPT (DALL-E):**
```
Game UI icon of a magical potion bottle or enchanted chest, 3D
rendered with purple and teal magical glow, metallic clasp details,
warm highlights, dark transparent background, 256x256 pixels,
fantasy game icon style, clean edges.
```

**Leonardo AI:**
```
Game UI magical shop icon, enchanted potion bottle or chest, 3D
shading, purple teal magical glow, metallic details, warm highlights,
transparent dark background, 256x256, fantasy game style, clean edges
```

---

### 2.3 Leaderboard Icon
- **Archivo actual**: `leaderboard-menu.{png,webp}`
- **Usado en**: Dock position 4 (leaderboard sheet trigger)

**ChatGPT (DALL-E):**
```
Game UI icon of a medieval scroll or ranking board with golden crown
on top, 3D rendered with warm metallic shading, parchment texture,
amber and gold tones, dark transparent background, 256x256 pixels,
fantasy game icon style, clean edges.
```

**Leonardo AI:**
```
Game UI leaderboard icon, medieval scroll or ranking board, golden
crown, 3D metallic shading, parchment texture, amber gold tones,
transparent dark background, 256x256, fantasy game style, clean edges
```

---

### 2.4 Invite / Share Icon
- **Archivo actual**: `invite-share-menu.{png,webp}`
- **Usado en**: Dock position 5 (invite button trigger)

**ChatGPT (DALL-E):**
```
Game UI icon of a magical envelope or letter with a wax seal and
sparkle effects, 3D rendered with warm gold and teal accents,
subtle glow, dark transparent background, 256x256 pixels, fantasy
game icon style, clean edges.
```

**Leonardo AI:**
```
Game UI invite icon, magical envelope with wax seal, sparkle effects,
3D shading, warm gold and teal accents, subtle glow, transparent
dark background, 256x256, fantasy game style, clean edges
```

---

### 2.5 Arena / Free Play Icon (center dock)
- **Archivo actual**: Lucide `Swords` SVG (no es imagen)
- **Usado en**: Dock center position (Link to `/arena`)
- **Estado**: Actualmente un SVG inline. Podria quedarse o upgradear.

**ChatGPT (DALL-E):**
```
Game UI icon of two crossed medieval swords with magical teal energy
between them, 3D rendered with metallic steel blades and golden hilts,
teal glow effect, dark transparent background, 256x256 pixels,
fantasy game icon style, dynamic and powerful feel.
```

**Leonardo AI:**
```
Game UI crossed swords icon, medieval blades, magical teal energy,
3D metallic rendering, steel blades golden hilts, teal glow,
transparent dark background, 256x256, fantasy game style, dynamic
powerful feel
```

---

## 3. UI Frames & Decorative Elements

### 3.1 Panel Frame
- **Archivo actual**: `panel-frame-rune.{png,webp,avif}`
- **Usado en**: globals.css `--playhub-rune-frame`, `.rune-frame` class
- **Estado**: Evaluar si el frame actual se alinea con el nuevo surface treatment

**ChatGPT (DALL-E):**
```
Game UI decorative panel frame border, dark fantasy style with subtle
golden rune engravings on corners, beveled edges, semi-transparent
dark center area, medieval ornate but not busy, PNG with transparency,
9-slice compatible layout, navy and gold color scheme, no text.
Clean lines suitable for UI overlay.
```

**Leonardo AI:**
```
Game UI panel frame border, dark fantasy style, golden rune corner
engravings, beveled edges, semi-transparent dark center, medieval
ornate, PNG transparency, 9-slice compatible, navy gold scheme,
no text, clean UI lines
```

---

### 3.2 Shop Slot Frame
- **Archivo actual**: `shop-slot-frame.{png,webp,avif}`
- **Usado en**: globals.css `--playhub-slot-frame`
- **Estado**: Evaluar con nuevo surface system

**ChatGPT (DALL-E):**
```
Game UI item slot frame, dark fantasy card border with subtle metallic
trim, beveled inset for item display, rounded corners, dark navy
center with slight inner glow, PNG with transparency, 256x256,
9-slice compatible, clean game UI style.
```

**Leonardo AI:**
```
Game UI item slot frame, dark fantasy card border, metallic trim,
beveled inset, rounded corners, dark navy center, inner glow,
PNG transparency, 256x256, 9-slice compatible, clean game style
```

---

## 4. Reward & Achievement Assets

### 4.1 Score Achievement Icon
- **Archivo actual**: `score-chesscito.{png,webp,avif}`
- **Usado en**: `result-overlay.tsx` (score variant success image)

**ChatGPT (DALL-E):**
```
Game UI achievement icon of a golden star burst with magical sparkles,
3D rendered with warm metallic gold shading, teal magical particles,
radiant glow effect, dark transparent background, 256x256 pixels,
fantasy game style, celebratory feel.
```

**Leonardo AI:**
```
Game UI golden star burst achievement icon, 3D metallic gold shading,
magical sparkles, teal particles, radiant glow, transparent dark
background, 256x256, fantasy game style, celebratory
```

---

### 4.2 Badge Achievement Icon
- **Archivo actual**: `badge-chesscito.{png,webp,avif}`
- **Usado en**: `result-overlay.tsx` (shop variant), badge displays

**ChatGPT (DALL-E):**
```
Game UI badge icon, ornate medieval shield with chess piece emblem
in center, golden border with jewel accents, 3D rendered with
metallic shading, warm amber glow, dark transparent background,
256x256 pixels, fantasy game collectible style.
```

**Leonardo AI:**
```
Game UI badge icon, ornate medieval shield, chess piece emblem, golden
border, jewel accents, 3D metallic shading, warm amber glow,
transparent dark background, 256x256, fantasy game collectible style
```

---

### 4.3 Reward Glow Backdrop
- **Archivo actual**: `reward-glow.{png,webp,avif}`
- **Usado en**: Reward ceremony background glow
- **Estado**: Podria ser pure CSS. Evaluar si el asset agrega valor vs gradients.

---

## 5. Game Board & Gameplay

### 5.1 Chess Board
- **Archivo actual**: `chesscito-board.{png,webp,avif}`
- **Usado en**: globals.css `--playhub-board-bg`, board.tsx
- **Estado**: El tablero actual funciona bien. Upgrade opcional P3.

**ChatGPT (DALL-E) (si se decide upgrade):**
```
Top-down view of an ornate fantasy chess board, 8x8 grid with
alternating teal-green and dark navy squares, carved dark wood border
with golden inlay details, medieval craftsmanship, warm amber lighting
from edges, square format 1:1 ratio, 1024x1024 pixels, painterly
game art style, no pieces, subtle wood grain texture.
```

**Leonardo AI:**
```
Top-down fantasy chess board, 8x8 grid, teal-green and dark navy
squares, carved wood border, golden inlay, medieval craftsmanship,
amber edge lighting, 1:1 square ratio, 1024x1024, painterly game
art, no pieces, wood grain texture
```

---

### 5.2 Target Circle
- **Archivo actual**: `target-circle.{png,webp,avif}`
- **Usado en**: board.tsx (animated target indicator)
- **Estado**: Funcional. Upgrade opcional.

---

## 6. Branding & Identity

### 6.1 Wolf Mascot / Favicon
- **Archivo actual**: `favicon-wolf.{png,webp}`
- **Usado en**: Phase flash, defeat screen, mission panel, legal pages
- **Estado**: Se usa como mascota mini. Podria upgradear a version mas detallada.

**ChatGPT (DALL-E):**
```
Game mascot icon of a friendly cartoon wolf wearing a medieval chess
crown, expressive eyes, warm amber and teal color accents, 3D
rendered with soft shading, dark transparent background, 512x512
pixels, suitable as app icon and in-game mascot, fantasy game style,
appealing and memorable.
```

**Leonardo AI:**
```
Game mascot wolf icon, friendly cartoon, medieval chess crown,
expressive eyes, amber and teal accents, 3D soft shading, transparent
dark background, 512x512, app icon quality, fantasy game style,
appealing memorable
```

---

### 6.2 OG / Social Preview Image
- **Archivo actual**: `og-home.jpg`
- **Usado en**: layout.tsx metadata, social sharing
- **Estado**: Deberia actualizarse para reflejar el nuevo look

**ChatGPT (DALL-E):**
```
Social media preview card for "chesscito" chess learning game. Fantasy
medieval chess scene with glowing chess pieces, warm amber and teal
magical atmosphere, bold game-style "chesscito" text, "Learn chess
on Celo" tagline. Landscape format 1200x630 pixels, dark background,
vibrant and eye-catching, mobile game marketing style.
```

**Leonardo AI:**
```
Social media preview card, chess learning game, fantasy medieval chess
scene, glowing pieces, amber and teal atmosphere, bold game text
"chesscito", landscape 1200x630, dark background, vibrant eye-catching,
mobile game marketing style
```

---

## 7. Chess Piece Art (12 pieces)

- **Archivos actuales**: `w-{piece}.{png,webp,avif}`, `b-{piece}.{png,webp,avif}`
- **Usado en**: board, piece rail, arena, promotions, badges, result overlay
- **Estado**: Funcionales. Upgrade a estilo mas premium es P3.

**ChatGPT (DALL-E) — ejemplo para Rook blanca:**
```
Fantasy chess rook piece, white/ivory color with golden accents and
subtle magical teal glow, 3D rendered with detailed stone texture,
medieval castle tower design, metallic highlights, dark transparent
background, 512x512 pixels, game asset style, clean edges for
compositing. Front-facing, slight upward angle.
```

**Leonardo AI — ejemplo para Rook blanca:**
```
Fantasy chess rook piece, white ivory, golden accents, teal magical
glow, 3D stone texture, medieval tower design, metallic highlights,
transparent dark background, 512x512, game asset, clean edges,
front-facing slight angle
```

> Repetir para: bishop, knight, pawn, queen, king (white + black variants = 12 total).
> Black pieces: mismos prompts pero reemplazar "white/ivory" por "dark purple/obsidian with violet magical glow".

---

## 8. Animations (Lottie)

### Assets existentes (mantener)
- `sparkles.json` — Confetti/sparkle background
- `trophy.json` — Trophy celebration
- `sparkle-burst.lottie` — Exercise success burst
- `error-alert.lottie` — Error state
- `sandy-loading.lottie` — Loading spinner

### Assets nuevos necesarios (P1-P2)
| Asset | Uso | Fuente |
|-------|-----|--------|
| `confetti-gold.lottie` | Reward ceremony v2 celebration burst | LottieFiles free search: "gold confetti celebration" |
| `badge-reveal.lottie` | Badge claim ceremony sweep effect | LottieFiles free search: "reveal shine sweep" |
| `star-collect.lottie` | Enhanced star collection animation | LottieFiles free search: "star collect game" |

---

## Prioridad de Produccion

| Prioridad | Asset | Impacto |
|-----------|-------|---------|
| **P0** | Play Hub Background (1.1) | Transforma la percepcion del mundo |
| **P1** | Arena Background (1.2) | Diferencia arena del hub |
| **P1** | 5 Dock Icons (2.1-2.5) | Cambia la nav de "web" a "game" |
| **P1** | Score + Badge Icons (4.1-4.2) | Mejora reward ceremony |
| **P1** | Wolf Mascot upgrade (6.1) | Identidad de marca |
| **P2** | Sheet Backgrounds (1.4-1.6) | Profundidad en screens secundarias |
| **P2** | UI Frames (3.1-3.2) | Polish de superficies |
| **P2** | OG Image (6.2) | Marketing/social |
| **P2** | Lottie animations (8) | Motion enhancement |
| **P3** | Splash Background (1.3) | Onboarding refresh |
| **P3** | Chess Board (5.1) | Gameplay visual upgrade |
| **P3** | Chess Pieces x12 (7) | Asset art quality |

---

## Formato de Entrega

Cada asset generado debe entregarse en:
1. **PNG** — full quality, transparencia si aplica
2. **WebP** — quality 80, target < 300KB backgrounds, < 50KB icons
3. **AVIF** — quality 60, target < 200KB backgrounds, < 30KB icons

Resoluciones:
- Backgrounds: 1170x2532 (3x mobile vertical)
- Icons: 256x256 o 512x512 (se escalan en CSS)
- Board: 1024x1024 (1:1)
- Pieces: 512x512 con transparencia
- OG: 1200x630

---

## Total de Assets a Producir

| Categoria | Cantidad | Estado |
|-----------|----------|--------|
| Backgrounds | 6 | Todos nuevos |
| Dock Icons | 5 | Todos nuevos |
| UI Frames | 2 | Evaluar si CSS alcanza |
| Reward Icons | 2 | Nuevos |
| Mascot | 1 | Upgrade |
| OG Image | 1 | Nuevo |
| Board | 1 | Opcional P3 |
| Chess Pieces | 12 | Opcional P3 |
| Lottie Anims | 3 | Buscar en LottieFiles |
| **Total** | **~33** | **17 core + 16 opcionales** |
