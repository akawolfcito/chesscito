# Chesscito Pitch Video — Asset Canon (V3.2)

**Fecha:** 2026-04-28
**Alcance:** A-Cut (9 escenas) bajo el sistema light editorial warm
**Regla:** No inventar assets importantes. Si no hay asset fuerte → typography-only.

---

## Asset inventory (estado actual)

### Portraits

- César Litvinov: **NO encontrado** en el repo
- Luis Fernando Ushiña: **NO encontrado** en el repo
- Conclusión: ambos vértices humanos del A-Cut van **typography-only**.

### Real product screenshots disponibles

Los assets fuertes viven en `apps/web/public/art/landing/`:

| Asset | Path | Resolución | Calidad |
|---|---|---|---|
| Play Hub hero | `apps/web/public/art/landing/hero-play-hub.png` | 720 × 1557 | ✅ premium, sin chrome |
| Pre-chess exercise | `apps/web/public/art/landing/pre-chess-exercise.png` | 720 × 720 | ✅ board detail crop limpio |
| Progress / Trophies | `apps/web/public/art/landing/progress-trophies.png` | 720 × 1557 | ✅ badges UI completo |

### Real product screenshots en `apps/video/public/screenshots/` (estado a corregir)

| Archivo | Tamaño | Realidad |
|---|---|---|
| `play-hub.png` | 564 KB | ⚠️ Es la **landing** (cream/cognac headline "Pequeñas jugadas"), no el play-hub de juego |
| `exercise-rook-pattern.png` | 564 KB | ⚠️ **Duplicado byte-a-byte** de `play-hub.png` |
| `arena.png` | 1.18 MB | ✅ Real Arena modal con difficulty selector |
| `victory-state.png` | 1.18 MB | ⚠️ **Duplicado byte-a-byte** de `arena.png` (no es victory) |

### UI crops disponibles (en `apps/web/public/art/redesign/`)

- Botones: `btn-play`, `btn-claim`, `btn-battle`, `btn-back`, `btn-resign`, `btn-undo` (cognac/wood UI)
- Banners: `banner-chess`, `banner-your-turn`, `vs-medal`
- Avatares de juego: `card-bot`, `card-you`, `player-opponent`, `player-you`
- Piezas: 38 archivos en `apps/web/public/art/pieces/` y `redesign/pieces/`

---

## Acciones recomendadas (asset prep)

Antes de aprobar el render MP4, copiar los 3 assets reales fuertes desde `apps/web/public/art/landing/` a `apps/video/public/screenshots/`:

```sh
cp apps/web/public/art/landing/hero-play-hub.png       apps/video/public/screenshots/play-hub.png
cp apps/web/public/art/landing/pre-chess-exercise.png  apps/video/public/screenshots/exercise-rook-pattern.png
cp apps/web/public/art/landing/progress-trophies.png   apps/video/public/screenshots/victory-state.png
# arena.png queda igual — ya es el Arena modal real
```

---

## Asset assignment por escena

### h01 — Hook
- **Recommended asset type:** ninguno (image-free)
- **Asset chosen:** —
- **Why:** apertura editorial. La presencia visual viene de la badge "PRE-AJEDREZ", el hero serif y la silueta CSS 4×4 (decorativa). Inyectar foto o producto rompería el aire de manifiesto.
- **Fallback:** N/A
- **Notas crop / shadow / framing:** mantener silueta CSS bottom-right rotada -8°, opacity 0.55 cap.

### h02 — Problem
- **Recommended asset type:** ninguno
- **Asset chosen:** —
- **Why:** la composición editorial bilateral (título + timeline) ya carga la escena. Agregar producto distrae.
- **Fallback:** N/A
- **Notas:** hairline cognac sigue siendo el conector visual; sin imagen.

### h03 — Capability
- **Recommended asset type:** real product screenshot (board detail)
- **Asset chosen:** `apps/web/public/art/landing/pre-chess-exercise.png` (720×720, board crop con rook + valid moves)
- **Why:** es exactamente "clear board / mental exercise / clean vertical capture / no browser chrome / no clutter" del spec. La paleta cream/green del board fluye con el paper bg V3.2.
- **Fallback:** typography-only con valueCards "Atención · Patrones · Decisiones" (ya existe). El phone solo agrega valor si la captura es fuerte.
- **Notas crop / shadow / framing:**
  - Renderizar dentro de `ProductPhone` (phone frame con halo warm + soft shadow grounded)
  - Crop ratio 9:19.5 forzado por PhoneFrame; si la fuente es 1:1 el `objectFit: cover` recorta arriba/abajo. **Acción:** agregar variante PhoneFrame "square-crop" o usar hero-play-hub (que ya es 720×1557, ratio cercano a 9:19.5) y dejar pre-chess-exercise como UI crop secundario.
  - Recomendación: usar `hero-play-hub.png` como screenshot de h03 también — es el board real con HUD, ratio correcto, mismo carácter pedagógico.

### h04 — Solution
- **Recommended asset type:** real product hero (entry / access feel)
- **Asset chosen:** `apps/web/public/art/landing/hero-play-hub.png` (720×1557)
- **Why:** comunica acceso inmediato — al abrir la app ves directamente un reto activo con HUD claro. Sin browser chrome. Cream/green se integra natural con paper bg.
- **Fallback:** typography-only + CTA "Empezar gratis" sin phone (ya soportado por el componente cambiando width=0; degradación pasable pero pierde el "producto primero").
- **Notas crop / shadow / framing:**
  - Width 500px en landscape, halo "warm" inset -55%, tone "light"
  - Tilt -1.2° (anclado, no flotante)
  - El badge "Empezar gratis" del propio screenshot interfiere ligeramente con el CTA decorativo nuestro — NO es problema porque ambos refuerzan el mismo CTA, pero registrar como nota visual.

### h05 — Coach / Method
- **Recommended asset type:** retrato real aprobado de César
- **Asset chosen:** **NINGUNO** (no existe portrait aprobado en el repo)
- **Why:** la regla es explícita — "Use portraits only if they are real and strong. If not, keep it text-based." Generar foto de César con IA está fuera de los allowed assets.
- **Fallback (en uso):** typography-only — paper cream + KnightMark CSS (4 celdas en L-pattern, evoca knight move sin pictograma) + serif statement con cognac italic en "pensar jugando." + `SignatureBlock` con "CÉSAR LITVINOV · MAESTRO FIDE" + "+100 estudiantes acompañados".
- **Notas:** si en el futuro hay retrato aprobado, integrarlo como tarjeta cuadrada (ratio 1:1) en el rail derecho con ratio dorado, sombra `light.shadow.phone`, tinte cream warm. Hasta entonces queda intencionalmente sin foto.

### h06 — Arena
- **Recommended asset type:** real Arena UI screenshot
- **Asset chosen:** `apps/video/public/screenshots/arena.png` (Arena modal real con difficulty selector + Easy/Medium/Hard pills + Enter Arena CTA)
- **Why:** captura cumple los 3 criterios — challenge / AI difficulty / active game feeling. Ya está en uso en V3.2.
- **Fallback:** typography-only con badge "ARENA" + 3 pills (IA / Ritmo propio / Práctica) — ya soportado.
- **Notas crop / shadow / framing:**
  - Width 500px landscape, halo warm, tone light
  - Tilt -1.2° anclado
  - **Riesgo:** el screenshot es vertical 9:19.5, el `objectFit: cover` recorta el dock inferior. Verificar que el difficulty selector y "Enter Arena" CTA queden visibles en el crop final.

### h07 — Celebration
- **Recommended asset type:** real progress / badges UI
- **Asset chosen:** `apps/web/public/art/landing/progress-trophies.png` (720×1557, "Your Badges" con Rook Ascendant 15/15 + locked badges + Claim Badge CTA)
- **Why:** comunica progreso personal real (no NFT-bait), badges desbloqueables, victories. La barra naranja de progreso refuerza "Logros · Victorias · Rachas".
- **Fallback:** typography-only con 3 pills + sparkles cognac sutiles + sin phone — degrada bien si la captura está caída.
- **Notas crop / shadow / framing:**
  - Width 500px, halo warm, tone light
  - El crop 9:19.5 de cover muestra parte superior del UI (claim badge en zona visible) — perfecto.
  - Sparkles cognac quedan **alrededor** del phone (62/22, 70/70, 88/30, 92/60, 78/12) — no encima del UI real para no competir con el badge claim.

### h08 — Team / Origin
- **Recommended asset type:** typography-led + opcional "100+" como número editorial
- **Asset chosen:** **NINGUNO** (sin portraits)
- **Why:** sin retratos reales aprobados, la escena vive como manifesto editorial. El "100+" outline cognac sirve como ancla visual sin convertirse en métrica de app.
- **Fallback (en uso):** paper alt + "100+" outline (font-size 460px landscape, weight 300, stroke 2px cognac, opacity 0.18) + caption "ESTUDIANTES" + título serif con cognac italic en "Convertido en juego." + firma serif italic con `Luis Fernando Ushiña · César Litvinov Alarcón · Den Labs`.
- **Notas:** si en el futuro hay retratos aprobados, layout sugerido: bloque historia + 2 mini-cards retrato (cuadradas, 240×240, paper border 1px cognac soft) + signature line. Hasta entonces queda decorativa.

### h09 — CTA
- **Recommended asset type:** ninguno (optional device only if it adds value)
- **Asset chosen:** —
- **Why:** un device aquí compite con el botón visual "Jugar ahora". El cierre debe sentirse manifesto + invitación, no demo.
- **Fallback:** N/A
- **Notas:** mantener título serif + hairline + subtitle + CTA cognac + url mono, sin phone.

---

## UI crops adicionales (para futuras escenas o refinamiento)

### Board / detail crops (3)
1. `pre-chess-exercise.png` — board completo cuadrado
2. Crop de `hero-play-hub.png` zona board (rows 250-1100) — board con HUD overlay
3. `apps/web/public/art/chesscito-board.png` — tablero plano sin piezas (para uso decorativo si necesario)

### CTA / button crops (2)
1. `apps/web/public/art/redesign/banners/btn-play.png` — wood-style "Play"
2. `apps/web/public/art/redesign/banners/btn-claim.png` — wood-style "Claim"
- *Nota:* estos botones tienen estética wood/dark UI del juego, NO se usan en el video porque el sistema light editorial usa el `LIGHT.cta` cognac. Listados aquí solo como referencia.

### Badge / progress crops (2)
1. Crop de `progress-trophies.png` zona Rook Ascendant card (~rows 180-300) — single badge with progress bar
2. `apps/web/public/art/badge-chesscito.png` — badge isolated

### Card / stat crops (2)
1. Crop de `progress-trophies.png` "View your Victories" CTA wood
2. Crop de `arena.png` "Community prize pool · $0.00" card — *NO usar en A-Cut* (mete tema económico, fuera de scope premium educativo)

---

## Acceptance / rejection log

### ✅ Accepted
- `pre-chess-exercise.png`, `hero-play-hub.png`, `progress-trophies.png` — clean, premium, paleta cream/green se integra
- `arena.png` (Arena modal) — real UI con jerarquía clara

### ❌ Rejected
- Generación AI de retratos para César/Luis — viola "fake or AI-generated for real people"
- "Community prize pool · $0.00" card — mete narrativa cripto/financiera fuera del A-Cut educativo
- Stock photos genéricos — viola "feel generic stock"

### ⚠️ A revisar (no bloqueante)
- El crop `objectFit: cover` del PhoneFrame recorta arriba/abajo en imágenes 1:1. **Acción:** considerar agregar variante `crop="contain"` al PhoneFrame para futuros assets cuadrados.
- Duplicados byte-a-byte en `apps/video/public/screenshots/` (play-hub == exercise-rook-pattern, arena == victory-state). **Acción:** correr los 3 `cp` listados arriba antes del render final.

---

## Decisión final por escena (resumen ejecutivo)

| # | Escena | Asset | Decisión |
|---|---|---|---|
| h01 | Hook | — | Editorial only ✓ |
| h02 | Problem | — | Editorial only ✓ |
| h03 | Capability | `hero-play-hub.png` | Reemplazar duplicado actual |
| h04 | Solution | `hero-play-hub.png` | Reemplazar duplicado actual |
| h05 | Coach | — | Typography fallback (sin portrait) ✓ |
| h06 | Arena | `arena.png` | Sin cambios — ya es real Arena UI ✓ |
| h07 | Celebration | `progress-trophies.png` | Reemplazar duplicado actual |
| h08 | Origin | — | Typography fallback (sin portraits) ✓ |
| h09 | CTA | — | Editorial only ✓ |

**Net new asset adds:** 3 archivos copiados desde `apps/web/public/art/landing/` (no se invalida ningún asset existente).
**MP4 render:** condicionado a la copia de los 3 archivos. No renderizar antes.
