# Taxonomía de superficies a pantalla completa

**Para qué sirve:** identificar en segundos, mirando una captura, **qué familia**
es una pantalla y por lo tanto qué reglas la gobiernan — sin abrir el código.
Pensado como referencia del builder de temas: la familia decide qué se puede
cambiar y qué NO.

**Última verificación contra el código:** 2026-07-29
**Cómo re-verificar:** `git grep -ln "fixed inset-0" -- 'apps/web/src/components/**/*.tsx'`
son las 16 superficies a pantalla completa. Cualquier archivo nuevo en esa lista
hay que clasificarlo acá.

---

## El criterio es ESTRUCTURAL, no emocional

Lo que separa las familias no es si el momento es de festejo. Es **si hay panel**:

| | **OVERLAY** | **MODAL / SHEET** |
|---|---|---|
| Fondo | scrim oscuro, se ve el juego debajo | scrim **+ panel crema / marco de madera** |
| Contenido | flota libre sobre la pantalla | vive **dentro** del panel |
| Ancho | el de la pantalla | el del panel (~340px) |
| Titular | `ArchedHeadline` (SVG arqueado) | `.arena-result-title` (Rowdies plano) |
| Cierre | tap en cualquier lado / auto | botón de cerrar en el panel |

> **Regla (founder, 2026-07-29): el arco es de los OVERLAY.** Un titular dentro de
> un panel crema se queda plano. El arco pide el ancho de la pantalla y un fondo
> oscuro detrás; adentro de un panel de 340px hay que achicarlo tanto que deja de
> leerse como cartel.

---

## Censo — las 16 superficies a pantalla completa

### 🎬 OVERLAY (scrim, sin panel) — el arco vive acá

| Superficie | Archivo:línea | Estado | Cómo verla |
|---|---|---|---|
| Flash de ejercicios (éxito / fallo) | `exercises/mission-panel-candy.tsx:317` | ✅ migrado | jugar `/exercises` y resolver |
| Celebración del Daily | `daily/daily-tactic-sheet.tsx:333` | ✅ migrado | `/` → Daily Tactic → resolver |

**La familia OVERLAY tiene exactamente dos miembros, y los dos ya usan el patrón.**
No hay trabajo de migración pendiente: lo que queda es que el **próximo** overlay
lo herede en vez de re-derivarlo (ver "Deuda" abajo).

### 🪟 MODAL / SHEET (con panel) — el arco NO va acá

| Superficie | Archivo | Panel | URL de probe |
|---|---|---|---|
| Fin de partida Arena | `arena/arena-end-state.tsx:412` | `VictoryPopupShell` | `/dev/arena-end-state?variant=resigned` |
| Victoria de Arena | `arena/victory-celebration.tsx` | `VictoryPopupShell` | `/dev/arena-end-state?variant=win-celebration` |
| Claim OK / en curso / error | `arena/victory-claim-{success,ing,error}.tsx` | `VictoryPopupShell` | `/dev/arena-end-state?variant=win-success` · `win-claiming` · `win-error` |
| Promoción (Arena) | `arena/promotion-overlay.tsx` | `VictoryPopupShell` | `/dev/promotion-run` |
| Soft gate | `arena/soft-gate-sheet.tsx` | sheet | — |
| Resultado / badge / tienda / error | `exercises/result-overlay.tsx` | `VictoryPopupShell` | `/dev/exercises-popups?variant=result-badge` · `piece-complete-final` · `result-shop` · `result-error` |
| Laberinto completo | `exercises/labyrinth-complete-overlay.tsx` | `VictoryPopupShell` | `/dev/exercises-popups?variant=labyrinth-king-solved` |
| Rescate por escudo | `exercises/fail-rescue-modal.tsx` | marco `panel-frame-rune` | `/dev/rescue-modal` |
| Briefing de misión | `exercises/mission-briefing.tsx:106` | panel `panel-mision-icon` | — |
| Detalle de misión | `exercises/mission-detail-sheet.tsx` | sheet | — |
| Elegir promoción | `exercises/promotion-picker.tsx:57` | tarjeta ámbar | `/dev/promotion-run` |
| Confirmar compra | `exercises/purchase-confirm-sheet.tsx` | sheet | — |
| Límite del Daily | `daily/daily-limit-banner.tsx` | banner | — |
| Compartir | `share/share-modal.tsx` | modal | — |
| Saldo de Peones | `peones/peones-balance-chip.tsx` | popover | `/dev/peones-chip` |
| Shell genérico | `redesign/candy-glass-shell.tsx` · `ui/sheet.tsx` | infraestructura | — |

Los probes gatean por `isDevSurfaceEnabled()` (`VERCEL_ENV !== "production"`), así
que **también viven en preview**: se pueden abrir desde el celular con el dominio
del deploy, sin levantar `pnpm dev`.

---

## Deuda: el overlay no está extraído

Los dos overlays **repiten** la composición a mano — headline arqueado, línea de
lección con alto reservado de 2 líneas, avatar, píldoras de premio, prompt de tap.
Ya divergen: el flash de ejercicios tiene línea de lección y píldoras, el del Daily
no. Un tercer overlay hoy se escribe copiando uno de los dos.

**Recomendación:** extraer un `CelebrationOverlay` con slots (headline, línea de
apoyo, avatar, premios, prompt) antes de agregar el tercero. Las invariantes que
tiene que preservar están en el componente y en
`docs/audits/2026-07-29-celebration-headline-audit.md`:

- La caja de la línea de apoyo mide **siempre 2 líneas**, o el titular salta y se
  corta contra el borde superior.
- El bloque de texto cuelga con `bottom-full` y **crece hacia arriba**; el aire se
  compra achicando el avatar, nunca con margen negativo (eso mueve la colisión al
  otro extremo).
- El ancho lo tiene que fijar el wrapper: un hijo absoluto **no puede** superar su
  bloque contenedor por más `max-width` que tenga.

---

## Si aparece una superficie nueva

1. ¿Tiene panel crema / marco de madera? → **MODAL**, titular plano.
2. ¿El juego se ve detrás y el contenido flota? → **OVERLAY**, titular arqueado.
3. Agregala a la tabla de arriba y, si es overlay, dale probe `/dev` — sin probe
   no hay forma barata de verificarla ni de fotografiarla en VR.
