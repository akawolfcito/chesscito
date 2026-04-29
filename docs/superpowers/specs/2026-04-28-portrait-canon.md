# Chesscito Pitch Video — Portrait Canon

**Fecha:** 2026-04-28
**Alcance:** A-Cut V3.2 light editorial warm — escenas con presencia humana
**Regla central:** No invent. No AI-generated portraits of real people. Sin retrato real aprobado → placeholder typográfico que **reserva el slot**.

---

## Por qué este canon existe

El A-Cut V3.2 ya está cerrado visualmente (paper warm + cognac + serif editorial).
Faltan dos escenas que requieren presencia humana:

- **h05 Coach** — habla del método de César Litvinov.
- **h08 Origin** — habla del equipo fundador (Luis + César).

Sin retratos reales aprobados, ambas viven hoy con tipografía-only. Funciona, pero subdimensiona el componente humano del proyecto. Este canon define exactamente qué retratos aceptamos, dónde se ubican, y cómo se reemplaza el placeholder cuando los assets reales lleguen.

---

## Decisión cerrada por escena

| Escena | Retrato | Rationale |
|---|---|---|
| **h05 Coach** | **1 retrato — César Litvinov** (medio plano, 4:5, derecha del statement) | Coach scene es por definición sobre una persona. César + Maestro FIDE + +100 estudiantes pierde ancla sin cara. |
| **h08 Origin** | **2 retratos — Luis Fernando Ushiña + César Litvinov Alarcón** (stack horizontal, 4:5, encima de signature line) | Founders duo. Den Labs queda como texto en la firma porque es brand, no persona. |
| h01, h02, h03, h04, h06, h07, h09 | Sin retrato | Producto / editorial / abstracción dominante; fotos no agregan. |

---

## Criterios de calidad — retratos aceptables

### Plano

- **Tipo:** medium close-up — cabeza + hombros + algo de torso.
- **Encuadre:** sujeto descentrado ligeramente (regla de tercios) o centrado limpio. **Evitar** crops apretados de cara completa.
- **Aspect ratio entregado:** 4:5 vertical (ej. 1200 × 1500 px mínimo).
- **Mirada:** preferentemente a cámara para conexión directa, o a 3/4 si el sujeto está en contexto (mirando hacia el centro de la composición, no afuera).

### Fondo

- **Paleta sugerida:** crema, cognac suave, beige neutro, blanco roto, madera cálida, biblioteca, espacio educativo.
- **Evitar:** azul corporativo, gris frío, verde fluorescente, oficinas SaaS, walls vacíos blanco-puro.
- **Profundidad:** out-of-focus suave (bokeh), no fondo plano duro. Si el fondo es plano, debe ser cálido y limpio.
- **Sin distracciones:** logos, marcas terceros, ventanas con sobreexposición, gente al fondo.

### Iluminación

- **Tipo:** natural soft o key light cálida única.
- **Contraste:** medio. Ni plano (publicidad pharmaceutical) ni dramático (noir).
- **Temperatura:** cálida (3200K – 4500K). Nada de blue-hour ni LED frío.
- **Sombra:** sutil bajo el mentón, mejilla y costado. Sin crujidos hard.

### Estilo

- **Procesamiento:** mínimo. Skin natural, no over-airbrushed.
- **Color grade:** warm-leaning — leve push hacia cognac/honey en los tonos medios. Coherente con el sistema V3.2.
- **Atmósfera:** humana, calmada, con autoridad pero no solemne. Pensar "manifesto de marca", no "perfil LinkedIn".

### Calidad técnica

- **Resolución mínima:** 1200 × 1500 px (preferible 2400 × 3000 para downsampling).
- **Formato:** JPG o PNG. JPG calidad ≥ 90% si se usa.
- **Sin watermark, sin firma de fotógrafo visible.**
- **Sin overlay de texto.**
- **Sin filter de Instagram, FaceApp, ni AI restoration agresiva.**

### Aprobación obligatoria

- Cada retrato debe ser **aprobado explícitamente por la persona retratada** antes de commit.
- Si el retrato existe pero no fue aprobado, fallback to placeholder.
- Si el retrato fue tomado en un contexto laboral / evento, validar que la persona acepta el uso para pitch público.

---

## Workflow de drop de assets

### Naming convention

Archivos en `apps/video/public/portraits/`:

- `cesar-litvinov.jpg`
- `luis-ushina.jpg`

(snake-kebab del nombre real, sin tildes ni espacios; alineado con `apps/video/public/screenshots/`.)

### Steps para reemplazar placeholder

1. Confirmar approval explícito del retratado.
2. Crop al ratio 4:5 (1200 × 1500 mínimo).
3. Color grade leve hacia warm si el original viene frío.
4. Drop en `apps/video/public/portraits/<key>.jpg`.
5. Editar `apps/video/src/lib/pitch-copy.ts` → setear `hasPortraitAsset: true` para esa key (o equivalente flag — ver implementación abajo).
6. Re-render h05 y/o h08 con `pnpm --filter video exec remotion still ...` para validar.
7. Commit: `chore(video): drop César portrait for h05/h08` + footer.

### NO drop si:

- Es selfie de baja resolución.
- Es retrato de evento con luz dura, fondo distraído, expresión accidental.
- Es generado/editado con AI sobre un retrato real.
- No fue aprobado explícitamente.

---

## Layout — h05 Coach con retrato

### Composición landscape (1920 × 1080)

```
┌────────────────────────────────────────────────────────────┐
│   PAPER CREAM + WARM POOL                                  │
│                                                            │
│   ▌ KnightMark cognac                                      │
│                                                            │
│   "Antes de competir,                       ┌──────────┐   │
│    hay que aprender a                       │          │   │
│    pensar jugando."                         │  César   │   │
│                                             │   foto   │   │
│   ─── (cognac hairline)                     │  4:5     │   │
│   CÉSAR LITVINOV · MAESTRO FIDE             │ 360×450  │   │
│   +100 estudiantes acompañados              └──────────┘   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

- Retrato a la derecha, 360 × 450 px en frame paper border 1 px cognac soft + shadow card.
- Sin tilt agresivo (-1° opcional o sin rotación).
- Halo warm muy tenue alrededor del frame (no glow).
- Texto a la izquierda con la actual cascada (statement → highlight → hairline → signature block).

### Fallback placeholder (sin asset)

Mismo slot 360 × 450, fondo paper warm, border 1 px cognac, shadow soft.
Contenido: iniciales **CL** en serif italic 96 px cognac, centradas; nombre "César Litvinov" en sans tracked uppercase 14 px abajo; rule cognac de 40 px sobre las iniciales.
**El slot reserva exactamente el mismo espacio que el retrato real.**

---

## Layout — h08 Origin con retratos

### Composición landscape (1920 × 1080)

```
┌────────────────────────────────────────────────────────────┐
│   PAPER ALT (más cálido) + WARM POOL                       │
│                                                            │
│   100+      Nacido en el aula.                             │
│  outline    Convertido en juego.                           │
│  cognac                                                    │
│             Una metodología aplicada con +100 estudiantes. │
│                                                            │
│             ┌────────┐ ┌────────┐                          │
│             │  Luis  │ │ César  │                          │
│             │ 240×300│ │240×300 │                          │
│             └────────┘ └────────┘                          │
│             Luis Fernando Ushiña · César Litvinov · Den Labs│
└────────────────────────────────────────────────────────────┘
```

- 2 retratos 240 × 300 (4:5) en stack horizontal, gap 18 px.
- Frame igual al de h05 (paper border + shadow card), tilt 0°.
- Si solo 1 de los 2 está disponible → render 1 + placeholder del otro. Layout no se mueve.
- Signature line debajo, idéntica a la actual.

### Fallback placeholder

Idéntica lógica que h05: iniciales serif italic 56 px (smaller per slot), nombre debajo, sin foto.

---

## Componente reusable — `Portrait.tsx`

Helper compartido en `apps/video/src/scenes/pitch/_shared/Portrait.tsx` con la siguiente API:

```ts
interface Props {
  name: string;             // "César Litvinov"
  role?: string;            // "Maestro FIDE"
  portraitKey?: PortraitKey; // "cesar-litvinov" | "luis-ushina" | undefined
  hasAsset?: boolean;       // explicit flag — false until approved drop
  size?: "sm" | "md";       // sm = 240×300 (h08), md = 360×450 (h05)
  opacity?: number;
  rotateDeg?: number;
}
```

Cuando `hasAsset` es `false` o no hay `portraitKey` → render placeholder (iniciales + nombre).
Cuando `hasAsset` es `true` → render `<Img>` desde `portraits/<key>.jpg` con el mismo frame.

Esto garantiza que el reemplazo es un cambio de un solo flag — sin tocar layout.

---

## Compromiso de cierre

Una vez aprobado este canon:

1. NO se reabren decisiones de retrato salvo que se rechace un asset por falta de calidad.
2. NO se exploran otros estilos de integración.
3. NO se generan retratos con AI.
4. Si los retratos no llegan antes del MP4 final, el video sale con placeholders (consistentes con el sistema editorial) — los retratos son drop-in upgrade, no blocker.

---

## Status del canon

- ✅ Cerrado a 2026-04-28
- ⏳ Esperando: drop de `cesar-litvinov.jpg` + `luis-ushina.jpg`
- ⛔ No bloquea MP4 final
