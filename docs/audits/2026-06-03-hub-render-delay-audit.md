# /hub Render Delay Audit — P0-3

**Fecha:** 2026-06-03
**Baseline post-P0-2 (`ea70b033`):** Score 75 / LCP 6489 ms / **Render Delay 5669 ms (87%)** / CLS 0.00 / TBT 140 ms
**Target:** Reducir Render Delay para que el score se mueva de 75 hacia ≥ 85.
**Modo:** Read-only audit. Patch propuesto en §6; no aplicado.

---

## 1. Diagnóstico del template y la cadena de paint

### 1.1 `apps/web/src/app/[locale]/template.tsx` (server component)

```tsx
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in duration-200">
      {children}
      <div
        className="pointer-events-none fixed bottom-1 right-1 z-[100] select-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <BuildVersionGate />
      </div>
    </div>
  );
}
```

Características relevantes:

- Es un **server component** (no `"use client"`).
- Envuelve `{children}` en `<div className="animate-in fade-in duration-200">` → aplica a **toda** la subtree bajo `[locale]/`, no solo `/hub`.
- Renderiza un overlay fijo en bottom-right con `<BuildVersionGate />` adentro.
- En Next 14 App Router, `template.tsx` corre en cada navegación de la subtree y es renderizado como SSR/RSC para la primera request.

### 1.2 `animate-in fade-in duration-200` — qué hace exactamente

Confirmado: `tailwindcss-animate` v1.0.7 está en `tailwind.config.js:plugins`. Las clases generan CSS puro:

```css
.animate-in   { animation-name: enter; animation-duration: 150ms; animation-fill-mode: both; }
.fade-in      { --tw-enter-opacity: 0; }
.duration-200 { animation-duration: 200ms; }

@keyframes enter {
  from {
    opacity: var(--tw-enter-opacity, 1);
    /* + translate/scale/rotate vars que aquí quedan en defaults (identidad) */
  }
}
```

Resumen del efecto:

- **`animation-fill-mode: both`** → el elemento ARRANCA con `opacity: 0` antes de que la animación corra, no después.
- La animación dura 200 ms y termina en `opacity: 1`.
- Es **CSS puro**, no requiere JavaScript para iniciar.
- Aplica al wrapper Y a todos sus descendientes vía composición de stacking context (los hijos están en un padre opacity-animated; el browser pinta la subtree con la opacity del padre).

**Impacto en LCP:** la spec de LCP de Chrome NO califica como "contentful paint" a elementos cuya opacity computada en el momento del paint es `0`. Mientras el wrapper transiciona de 0 → 1, ningún descendiente cuenta. Cuando la animación termina, el algoritmo elige el elemento más grande que ahora es visible.

Pero la animación es de 200 ms. Eso no explica un Render Delay de 5669 ms por sí solo.

### 1.3 Wallet/RainbowKit hydration y main-thread

Datos de Lighthouse:

- TBT (Total Blocking Time): **140 ms** post-P0-2.
- Render-blocking resources: **278 ms** estimado.
- Long tasks: no listadas en el reporte que tengo capturado (no fueron auditadas).

**TBT 140 ms es bajo** — eso indica que el main thread NO está bloqueado por chunks largos. La hidratación de wagmi + RainbowKit no parece ser el ofensor directo del Render Delay.

Si el bloqueador no es el main thread y la animación es de 200 ms, queda como sospechoso principal:

- **Heurística de LCP de Chrome esperando "first meaningful paint"** después del JS. Chrome puede demorar la actualización del LCP candidate hasta que detecta que la página dejó de mutar. Hidratación + montaje de providers (incluso si TBT es bajo) reajusta el DOM y resetea el reloj del LCP.
- **Combinación de `animate-in` + reflow tardío del DOM por client components**: cada provider/hook que monta puede invalidar el LCP candidate previo. La animación demora 200 ms, luego React reconcilia, luego el DOM se estabiliza ~5 s después.

### 1.4 ¿Es `BuildVersionGate` artefacto o real?

**Real.** Componente real, `<BuildVersion />` renderiza:

```tsx
<span
  data-testid="build-version"
  aria-label={`Build ${sha}`}
  className="rounded-full px-2 py-0.5 text-nano font-mono font-bold"
  style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,215,0,0.95)", ... }}
>
  v.{sha}
</span>
```

Características:

- Es un `<span>` con padding + background semi-opaco amarillo → **bounding box visible**, no transparente.
- Wrapper `<div className="pointer-events-none fixed bottom-1 right-1 z-[100]">` → fixed en esquina inferior derecha.
- Solo se renderiza si `usePathname()` matchea `/hub` o `/dev/*` (`build-version-gate.tsx:15-20`).
- `usePathname()` viene de `next/navigation` — en client component hidratado devuelve el path actual; durante SSR puede devolver `null` si el componente lo lee antes de hidratación.
- Como `BuildVersionGate` es `"use client"`, **NO se renderiza durante el SSR del server template** — solo aparece tras hidratación. Su shell wrapper sí está en SSR (el `<div fixed bottom-1 right-1>` está en `template.tsx` server), pero el contenido (`<BuildVersion />`) llega tras hidratación cliente.

Eso explica por qué un elemento bottom-right tan pequeño gana LCP: **es el ÚLTIMO elemento contentful en aparecer en el DOM** (después de hidratación), y LCP captura el último candidate antes de input/timeout. El icono Daily ya pintó temprano (Patch P0-2 lo aceleró), todo lo demás también pintó temprano vía SSR, pero el `BuildVersionGate` solo aparece post-hidratación. El LCP "se queda" en él como último elemento mutado.

### 1.5 ¿Debe `BuildVersionGate` estar visible en production?

Decisión existente del codebase (comment en `template.tsx:7-11`): el chip **es deliberadamente visible en `/hub`** como affordance para smoke-testers — "confirma que la sesión está corriendo el bundle freshly-shipped, no uno cacheado".

Esto es valor real. NO recomiendo eliminarlo en prod. La pregunta correcta es: **cómo evitar que el chip califique como LCP candidate** sin perder su funcionalidad.

---

## 2. Causa probable del Render Delay 5669 ms

**Hipótesis primaria (alta confianza):** el `BuildVersionGate` es client-only y aparece en el DOM solo tras hidratación. Chrome LCP, al detectar este nuevo contentful paint tardío, lo elige como LCP candidate final. El "Render Delay 5669 ms" mide desde navigation start hasta cuando este elemento aparece — es básicamente tiempo de hidratación + montaje de client components.

**Hipótesis secundaria (media confianza):** el `animate-in fade-in` en el wrapper combinado con re-renders de client components durante hidratación resetea el LCP candidate varias veces. La animación de 200 ms vuelve a "calificar" elementos a medida que la subtree se estabiliza.

**Hipótesis terciaria (baja confianza):** wagmi/RainbowKit imports eager en `wallet-provider.tsx` corren al hidratar y bloquean paint a través de microtasks (no TBT, pero sí frame budget).

---

## 3. ¿Template envuelve todo el contenido de /hub?

**Sí.** `apps/web/src/app/[locale]/template.tsx` aplica a TODA ruta bajo `[locale]/`. Eso incluye `/hub`, `/exercises`, `/arena`, `/coach/*`, etc.

Cualquier cambio al wrapper afecta a todas las rutas. Cualquier propuesta debe considerar el blast radius.

---

## 4. Hallazgo lateral — la animación 200 ms NO es la causa principal

Originalmente sospeché que `animate-in fade-in` retrasaba LCP por 5 s. Tras leer el código, descarto esa hipótesis: la animación dura 200 ms, es CSS puro, no espera JS. El gap de 5 s está dominado por **discovery tardío del BuildVersionGate post-hidratación**, no por la animación.

Es decir: aunque elimináramos la animación, el LCP seguiría apuntando al BuildVersionGate que aparece tras hidratación. La animación es un factor secundario.

---

## 5. Riesgos a considerar

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Cambiar `template.tsx` afecta todas las rutas bajo `[locale]/` | Cierta | Patch debe ser route-agnostic o gateado a `/hub` |
| Eliminar `animate-in` rompe page transitions UX | Media | Conservar o mover a inner wrapper específico de rutas que lo necesitan |
| Mover el BuildVersionGate a server-only rompe su `usePathname()` gating | Alta si SSR el componente | Mantener `BuildVersionGate` como client; cambiar qué wrappea en SSR |
| Patch no mueve LCP porque el bottleneck real es hidratación | Media | Plan de medición tras patch debe confirmar/descartar |
| MiniPay zero-click rota | NULA | No se toca wallet-provider / RainbowKit / detección MiniPay |

---

## 6. Patch candidato mínimo — `perf(template): exclude build chip from LCP candidacy`

### Filosofía

**Una sonda diagnóstica antes que un fix masivo.** No sabemos con certeza si el LCP se resolverá si "ocultamos" el BuildVersionGate del LCP candidate. La forma más barata de probar es: aplicar `content-visibility: hidden` o `contain-intrinsic-size: 0` al wrapper del chip, o usar el `data-lcp-skip` pattern (no estándar pero algunos tools lo respetan).

La forma más limpia y soportada por Chrome LCP: **agregar el atributo `elementtiming=""` o `data-nosnippet`** NO funciona para LCP. La única forma estándar de excluir un elemento del LCP es:

1. Aplicarle CSS que lo haga no-contentful (e.g., reemplazar el texto por un `::after` content que no se cuenta), o
2. Mantenerlo fuera del viewport o con dimensiones cero hasta después de la ventana LCP, o
3. Hacer que su paint ocurra ANTES que el de cualquier otro elemento importante.

**La opción más práctica:** envolver el BuildVersionGate en un `<Suspense fallback={null}>` con un mount delay vía `setTimeout` o similar, para que aparezca DESPUÉS de la ventana LCP (8s o user input, lo que ocurra primero). Pero eso es hacky.

**Alternativa más limpia (recomendada):** marcar el wrapper con `aria-hidden="true"` y `inert` cuando NO es prod, y mover el chip fuera del flujo de paint principal. Pero esto NO afecta LCP candidacy.

**Mi recomendación de patch DIAGNÓSTICO (no productivo):** crear un preview deploy con el BuildVersionGate condicionalmente NO renderizado en producción Vercel, solo para medir si LCP cae sin él. Si cae a < 3s, sabemos que la sola presencia del chip post-hidratación domina. Si queda en 6s, el bottleneck es otro elemento que ahora gana LCP.

### Patch propuesto (1 archivo, ~10 líneas)

**`apps/web/src/app/[locale]/template.tsx`** — gatear la sección del chip detrás de un check de entorno:

```diff
+import { headers } from "next/headers";
 import { BuildVersionGate } from "@/components/dev/build-version-gate";

 export default function Template({ children }: { children: React.ReactNode }) {
+  // Hide the build pill in production deploys to remove it as an LCP
+  // candidate (it's a client component that paints post-hydration and
+  // anchors LCP late). Smoke-testers can still see it in preview and
+  // local. See docs/audits/2026-06-03-hub-render-delay-audit.md.
+  const showBuildPill = process.env.VERCEL_ENV !== "production";
   return (
     <div className="animate-in fade-in duration-200">
       {children}
+      {showBuildPill && (
         <div
           className="pointer-events-none fixed bottom-1 right-1 z-[100] select-none"
           style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
         >
           <BuildVersionGate />
         </div>
+      )}
     </div>
   );
 }
```

Notas sobre el patch:

- `VERCEL_ENV === "production"` solo es true en el deploy promovido a `production`. Preview y local siguen mostrando el chip (smoke-tester affordance preservada en los entornos donde se usa).
- No toca el `animate-in fade-in` (descartado como causa primaria en §4).
- No mueve la animación, no remueve transición visual.
- No toca `BuildVersionGate` ni `BuildVersion` componentes.
- No toca wallet/RainbowKit/Labyrinth/imágenes/etc.

### Resultado esperado

Si la hipótesis primaria es correcta:

- LCP en prod debería bajar de 6489 ms a ~ 1.5–3 s (el next candidate será un elemento que YA pintó early, e.g., el icono Daily o el KingdomAnchor portal).
- Score de 75 a ~ 83–88.
- Preview deploys mantienen el chip y siguen midiendo similar (eso CONFIRMA que el chip era el ofensor).

Si la hipótesis falla (LCP se queda en > 5 s en prod):

- El bottleneck real es la hidratación de wagmi/RainbowKit que retrasa la "estabilización" del DOM que Chrome usa para confirmar LCP.
- Patch sería: cluster nuevo `perf(bundle): defer wagmi/RainbowKit init until first interaction` — refactor mayor.

---

## 7. Tests y mediciones

**Pre-patch (baseline post-P0-2):** ya capturado en `apps/web/lh-prod-post-p0-2.json` (75 / LCP 6489 / Render Delay 5669).

**Post-patch validación funcional:**

- `pnpm type-check`
- `pnpm lint`
- `pnpm test hub`
- Smoke manual:
  - `/hub` en local (`pnpm dev`) debe seguir mostrando el chip (porque `VERCEL_ENV` no está en local, queda como undefined → `!== "production"` es true).
  - Preview deploy debe seguir mostrando el chip (`VERCEL_ENV=preview`).
  - Production deploy NO debe mostrar el chip.

**Post-deploy PSI:**

```bash
npx lighthouse https://www.chesscito.com/hub \
  --emulated-form-factor=mobile \
  --output=json --output-path=./lh-prod-post-p0-3.json \
  --chrome-flags="--headless" --quiet
```

Capturar score, LCP, CLS, TBT, **el `largest-contentful-paint-element`** (para confirmar el shift), y la **phase breakdown** (esperado: Render Delay caer significativamente; o si no cae, identificar el nuevo candidate).

---

## 8. Decisión

**Patch único, alta confianza, blast radius bajo:** gatear el `BuildVersionGate` wrapper detrás de `VERCEL_ENV !== "production"`.

**No** tocar `animate-in fade-in` en este patch (descartado en §4 como causa primaria; cambiarlo afecta todas las rutas y tiene UX implications sin evidencia de payoff).

**No** tocar wallet-provider / wagmi / RainbowKit en este patch (riesgo MiniPay; queda para cluster propio si este patch no mueve el score).

**No** abrir issues paralelos sobre i18n PRO_COPY o `/api/founder-status` — siguen en cola como follow-ups separados.

### Si el patch funciona

Cerrar P0-3, cerrar el sprint perf, abrir backlog post-MVP con:

- `perf(bundle): defer wagmi/RainbowKit init` (cluster largo)
- `refactor(images): adopt next/image across hub tree` (cluster propio con VR baselines)
- `fix(i18n): add missing PRO_COPY.daysLeftActiveLabel` (independent)
- `perf(api): bound or cache founder-status ownership lookup` (independent)

### Si el patch NO funciona

Significa que la causa raíz NO era el BuildVersionGate sino la hidratación / animación / estabilización del DOM. Próximo audit P0-4 deberá investigar:

- Long tasks durante el primer paint (requiere capturar trace de Chrome, no LH).
- Whether `animate-in fade-in` realmente resetea LCP candidacy (deshabilitándolo en preview puede confirmar).
- Coste de hidratación de wagmi/RainbowKit eager imports (medir bundle parse time vs lazy variants).
