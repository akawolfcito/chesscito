# Handoff — Theme Builder + Runtime PRO Assets

**Fecha:** 2026-07-19  
**Estado:** ✅ Cerrado funcionalmente  
**Área:** `apps/web` · `/dev/theme-builder` · runtime themes · entitlement PRO · navegación Hub  
**Theme actual:** `candy-forest`

> Este documento consolida la implementación del catálogo de arte, la administración independiente de variantes DEFAULT/PRO, la conexión de consumidores en runtime y la unificación del entitlement PRO.
>
> La línea se considera cerrada para el alcance actual. El founder ya puede reemplazar progresivamente los assets DEFAULT y PRO desde el Theme Builder sin realizar cambios adicionales de código por cada icono.

## 1. Objetivo alcanzado

El Theme Builder permite administrar visualmente los assets utilizados por Chesscito y controlar sus variantes por nivel de acceso.

### Estados soportados

**DEFAULT**

- `asset`: usa un asset explícito.
- `none`: no muestra imagen.

**PRO**

- `asset`: usa un asset PRO explícito.
- `inherit`: reutiliza DEFAULT.
- `none`: no muestra imagen aunque DEFAULT exista.

Ahora es posible:

- reemplazar assets DEFAULT existentes;
- agregar un DEFAULT donde antes no existía;
- agregar una variante PRO a un slot que antes heredaba DEFAULT;
- volver una variante PRO a `inherit`;
- establecer DEFAULT o PRO como `none`;
- restaurar el estado anterior mediante Undo;
- generar automáticamente los triplets PNG/WebP/AVIF;
- reflejar los cambios en runtime para todos los slots activos;
- actualizar automáticamente todos los assets al hidratarse o cambiar el entitlement PRO.

No se utiliza un PNG transparente como sentinel.

## 2. Arquitectura final

### Catálogo

Ruta:

```text
/dev/theme-builder
```

El catálogo administra **162 slots** en aproximadamente 18–20 categorías, incluyendo:

- Hub
- Daily
- Coach
- Exercises
- Arena
- Board
- Account
- Shop
- PRO
- Scenes
- Backgrounds
- HUD
- Victory
- Welcome
- Shared

Cada slot muestra:

- variante DEFAULT;
- variante PRO;
- estado declarado;
- preview;
- dimensiones reales;
- path;
- `usedIn`;
- Replace image;
- None;
- Inherit, cuando aplica;
- Undo.

### Persistencia

Las variantes nuevas se guardan en rutas determinísticas server-side:

```text
/art/theme-builder/<theme>/<slot>/<variant>
```

Ejemplo:

```text
/art/theme-builder/candy-forest/hub/training/pro
```

El servidor:

- deriva el destino desde el slot y el registry;
- no acepta paths arbitrarios enviados por el cliente;
- actualiza el registry mediante AST de TypeScript;
- genera PNG, WebP y AVIF;
- mantiene backup de un nivel;
- restaura estado y archivos con Undo;
- conserva la allowlist y protecciones contra path traversal.

Upload permanece **local-only**, dado que el filesystem de Vercel es read-only.

## 3. Compatibilidad del modelo

Los strings históricos del registry continúan funcionando.

No fue necesario migrar manualmente los 162 slots a un modelo completamente nuevo.

La implementación agregó semántica administrable para:

```text
DEFAULT → asset | none
PRO     → asset | inherit | none
```

Se preservó una sola fuente de verdad. No se creó un registry paralelo.

## 4. Cobertura runtime

Antes del refactor, el Theme Builder podía reemplazar archivos físicos, pero muchos consumidores seguían resolviendo rutas `/art/...` hardcoded.

Eso impedía que una variante PRO nueva creada desde el catálogo se reflejara en la aplicación.

### Inventario inicial A–G

```text
A. Ya conectado:                    2
B. Migración directa JSX:          66
C. Componente compartido:          26
D. CSS/background:                 38
E. Ruta dinámica o compuesta:      19
F. Sin consumidor/deprecated:      11
G. Bloqueantes:                     0
```

### Cobertura final

```text
Slots activos conectados:          151
Deprecated:                          7
Sin consumidor activo:               4
Consumidores hardcoded activos:       0
```

Patrones encontrados —con grupos solapados—:

```text
<img>:                               55
<picture>:                           56
CSS/background:                      39
Maps compartidos:                    27
Rutas dinámicas:                     19
```

Se añadieron adaptadores comunes para:

- JSX / `<img>`;
- `<picture>`;
- CSS y backgrounds;
- mapas compartidos;
- rutas y piezas compuestas.

El estado `none` no produce:

```text
<img src="">
srcSet vacío
<picture> vacío
url("")
```

## 5. Entitlement PRO reactivo

Después de conectar los consumidores se detectó una inconsistencia: algunas rutas reconocían PRO y otras mostraban DEFAULT durante la misma sesión MiniPay.

### Causas raíz

1. El cache PRO podía capturarse antes de que MiniPay hidratara la wallet y no se releía al conectarse.
2. Distintos consumidores mantenían observadores independientes de `/api/pro/status` que no siempre compartían la misma query.
3. Las variantes checksum y lowercase de una misma wallet podían generar queries separadas.
4. Learn Hub y Play Hub tenían overrides locales de `ThemeVariant`.
5. El CTA `PRO UNLOCK`, los assets y algunas superficies no dependían exactamente de la misma decisión efectiva.
6. Learn usaba además el estado del Season Pass para decidir el tier visual, aunque Season Pass y suscripción PRO son entitlements distintos.

### Solución final

- `useEffectiveThemeTier()` conecta el entitlement efectivo con `ThemeVariantProvider`.
- El estado PRO se comparte mediante React Query.
- Las direcciones checksum y lowercase usan una única query.
- Se eliminaron los overrides locales de ThemeVariant en ambos Hubs.
- Learn, Play, Coach, Journal, CTA PRO y los 151 slots consumen el mismo estado reactivo.
- `useThemeAsset` y `resolveThemeAsset` requieren tier explícito en sus APIs de resolución.
- Las transiciones actualizan globalmente:

```text
default → pro → default
```

### Loading

- Sin cache: se muestra DEFAULT mientras llega la respuesta.
- Con cache PRO válido: se conserva PRO para evitar flicker.
- La respuesta autoritativa posterior actualiza todas las superficies.
- El cache conserva también el vencimiento cuando ya existe una respuesta autoritativa; el valor histórico `"1"` sigue siendo compatible durante la transición.

### Árbol de providers confirmado

El árbol principal de rutas localizadas tiene:

```text
1 QueryClientProvider
1 ThemeVariantProvider
1 WalletProvider en app/[locale]/layout.tsx
```

Learn Hub, Play Hub y Coach/Journal cuelgan del mismo layout. Las páginas `/dev` que montan `WalletProvider` son probes aislados y no forman parte del árbol principal de la mini app.

## 6. Navegación corregida

Se detectó una regresión independiente de themes:

```text
START FOCUS → Trophies
```

La causa era semántica: el label quedó fijo como START FOCUS, pero el handler seguía reutilizando el destino genérico del content loop. Los estados `claim-pending` y `view-progress` apuntan legítimamente a `/trophies`, pero no deben gobernar este CTA.

El comportamiento correcto quedó restaurado:

```text
START FOCUS → /exercises?piece=<piece>
Trophies    → /trophies
```

Se verificaron click, Enter, Space, hit area y viewport mobile. El ring decorativo de START FOCUS conserva `pointer-events: none`.

## 7. Localizador `usedIn`

Se clarificaron slots visualmente parecidos que anteriormente podían causar confusión durante las pruebas.

### Distinciones importantes

```text
hub.training
```

Se utiliza en:

- Coach tile de Play Hub;
- Coach action rail de Full Hub;
- header de Coach/Journal en `/coach/history`;
- headers de match review en `/coach/[gameId]`;
- Coach row del Account sheet.

```text
hub.train-pieces
```

Se utiliza en:

- icono de START FOCUS de Learn Hub;
- lado Training del selector Learn/Play;
- CTA principal de entrenamiento de Full Hub;
- acción Pieces del persistent dock.

```text
hub.training-icon
```

Se utiliza en:

- tile Special Training/Mate de Full Hub;
- pedestal Special Training de Exercises;
- celebración de unlock de Special Training;
- map compartido `ActionRowIcon` para `training-icon-v1`.

El dato previo que asociaba `hub.training` con `HubArenaTile` era incorrecto: `HubArenaTile` consume `hub.training-icon`.

El catálogo ahora comunica en líneas separadas, cuando es posible:

- archivo consumidor;
- componente;
- superficie o rol visual;
- ruta relacionada.

No debe inferirse la superficie únicamente a partir del nombre del slot.

## 8. Archivos centrales

### Control plane

```text
apps/web/src/lib/themes/theme-registry.ts
apps/web/src/lib/themes/catalog.ts
apps/web/src/lib/themes/registry-source.ts
apps/web/src/app/dev/theme-builder/page.tsx
apps/web/src/app/api/dev/theme-asset/route.ts
```

### Runtime plane

```text
apps/web/src/lib/themes/resolve-theme-asset.ts
apps/web/src/lib/themes/use-theme-asset.ts
apps/web/src/lib/themes/use-current-theme-asset.ts
apps/web/src/lib/themes/use-theme-background.ts
apps/web/src/lib/themes/piece-theme-assets.ts
apps/web/src/lib/themes/theme-variant-provider.tsx
apps/web/src/lib/themes/use-effective-theme-tier.ts
apps/web/src/components/themes/theme-asset-picture.tsx
apps/web/src/components/themes/theme-asset.tsx
apps/web/src/components/themes/theme-css-variables.tsx
```

### Entitlement y providers

```text
apps/web/src/components/wallet-provider.tsx
apps/web/src/lib/pro/use-pro-status.ts
apps/web/src/lib/pro/use-is-pro-active.ts
apps/web/src/lib/pro/use-pro-sheet-state.ts
apps/web/src/app/[locale]/layout.tsx
```

### Cobertura e inventario

```text
apps/web/scripts/audit-theme-runtime-coverage.mjs
docs/audits/2026-07-18-theme-runtime-inventory.json
apps/web/src/lib/themes/__tests__/provider-tree-invariant.test.ts
apps/web/src/lib/themes/__tests__/theme-entitlement-integration.test.tsx
```

## 9. Commits principales

### Administración de variantes

La implementación inicial de DEFAULT/PRO administrables incluyó:

- asset / inherit / none;
- rutas determinísticas;
- AST registry;
- Replace / Inherit / None / Undo;
- triplets optimizados.

### Conexión runtime

```text
80b5bb9f feat(themes): add shared runtime asset adapters
33ae4496 feat(themes): connect active asset consumers
bae7bef4 test(themes): enforce runtime catalog coverage
```

### Tier PRO reactivo

```text
69bf2930 fix(themes): restore reactive PRO tier selection
```

### Consistencia final y navegación

```text
4bca3713 fix(pro): unify Hub entitlement state
0ef5759c fix(hub): route Start Focus to exercises
21370033 chore(theme-builder): clarify training slot locations
```

## 10. Verificación final

### Tests

```text
Tests focalizados finales:           188 passed
Suite completa:                       5288 passed
Total de tests:                       5291
Fallos preexistentes:                    3
TypeScript:                           clean
Production build:                     passed
Páginas generadas:                    108
```

Fallos pedagógicos preexistentes y ajenos a themes:

- Bishop difficulty ramp.
- Rook difficulty ramp.
- Rook A5.

No deben atribuirse a esta implementación.

### Build

El production build finalizó correctamente.

Durante SSG aparecieron advertencias `ENOTFOUND` de red relacionadas con Supabase dentro del sandbox, pero no bloquearon el build.

### Smoke MiniPay-equivalente

Viewport:

```text
390 × 844
```

Verificado durante la línea completa de trabajo:

- Learn detecta PRO.
- Play detecta PRO.
- `PRO UNLOCK` desaparece para usuario PRO.
- Training muestra override PRO.
- Coach muestra override PRO.
- Journal muestra override PRO.
- Daily, Exercises, Arena y backgrounds resuelven correctamente.
- Coach → Hub conserva PRO.
- Learn ↔ Play conserva PRO.
- Usuario free recupera CTA y assets DEFAULT.
- `inherit` vuelve a DEFAULT.
- `none` elimina limpiamente el asset.
- Undo restaura el estado previo.
- No existen `img`, `srcSet`, `<picture>` o backgrounds vacíos.
- START FOCUS navega a Exercises.
- Trophies conserva su ruta.

La hidratación tardía DEFAULT → PRO y la invalidación PRO → DEFAULT también están cubiertas por la prueba de integración compartida de React Query y ThemeVariant.

## 11. Comandos de verificación

Usar Node 20 para Vitest en este workspace:

```bash
PATH=/Users/wolfcito/.nvm/versions/node/v20.19.5/bin:$PATH pnpm -F web exec tsc --noEmit
PATH=/Users/wolfcito/.nvm/versions/node/v20.19.5/bin:$PATH pnpm -F web test
PATH=/Users/wolfcito/.nvm/versions/node/v20.19.5/bin:$PATH pnpm -F web build
pnpm -F web theme:coverage
```

Modos usados para smoke local:

```bash
NEXT_PUBLIC_CHESSCITO_MODE=learn NEXT_PUBLIC_CHESSCITO_LITE_MODE=true pnpm -F web dev --port 3002
NEXT_PUBLIC_CHESSCITO_MODE=play NEXT_PUBLIC_CHESSCITO_LITE_MODE=false pnpm -F web dev --port 3002
NEXT_PUBLIC_CHESSCITO_MODE=full NEXT_PUBLIC_CHESSCITO_LITE_MODE=false pnpm -F web dev --port 3002
```

## 12. Invariantes que deben preservarse

Cualquier trabajo futuro debe mantener estas reglas:

1. **El cliente no define paths de escritura.**
2. **El registry sigue siendo la fuente de verdad.**
3. **No crear un segundo registry paralelo.**
4. **PRO `inherit` siempre resuelve DEFAULT.**
5. **PRO `none` nunca debe caer silenciosamente a DEFAULT.**
6. **DEFAULT `none` no debe renderizar una imagen vacía.**
7. **Todos los consumidores activos deben usar los adaptadores centrales.**
8. **El entitlement de assets, CTA y acceso funcional debe ser el mismo.**
9. **Una wallet checksum y lowercase representa la misma query PRO.**
10. **No agregar overrides locales de `ThemeVariant` en Hubs o rutas.**
11. **No introducir rutas `/art/...` hardcoded fuera de excepciones explícitas.**
12. **La cobertura debe fallar si aparece un consumidor activo no conectado.**
13. **Upload continúa local-only.**
14. **Los cambios de arte deben conservar PNG/WebP/AVIF y Undo.**
15. **No confundir `hub.training`, `hub.training-icon` y `hub.train-pieces`.**
16. **Season Pass no sustituye al entitlement PRO para elegir arte o mostrar el CTA PRO.**
17. **No montar otro QueryClient o ThemeVariantProvider dentro de una ruta del árbol principal.**

## 13. Estado operativo para el founder

El founder puede avanzar directamente desde:

```text
http://localhost:<port>/dev/theme-builder
```

Flujo esperado:

1. Elegir un slot.
2. Revisar `usedIn` para localizar su superficie exacta.
3. Subir DEFAULT o PRO.
4. Probar en usuario free y PRO.
5. Usar `inherit`, `none` o Undo cuando sea necesario.
6. Commit de registry + triplets.
7. Deploy.

Ya no debe ser necesario modificar el consumidor cada vez que se agregue una variante PRO a un slot activo.

## 14. Estado del worktree al cierre

Al crear este handoff existen cambios deliberados del founder todavía sin commit:

```text
apps/web/src/lib/themes/theme-registry.ts
apps/web/public/art/theme-builder/
```

Incluyen fixtures/estados reales creados desde el Theme Builder, entre ellos overrides PRO de `hub.training` y `hub.train-pieces`, además de cambios declarativos como `inherit`/`none` probados durante el smoke.

Una futura AI debe:

- tratarlos como cambios del usuario;
- no restaurarlos ni descartarlos;
- revisar registry y triplets juntos antes de stagear;
- evitar que una regeneración del inventario mezcle accidentalmente estos fixtures con otro commit;
- usar staging selectivo si modifica `theme-registry.ts` mientras esos cambios siguen pendientes.

También hay otros documentos/auditorías no relacionados sin commit. No deben incluirse automáticamente en una tarea de themes.

## 15. Líneas futuras — no necesarias ahora

La implementación actual cubre el objetivo inmediato. Las siguientes extensiones permanecen opcionales.

### Landing catalog

Agregar toggle:

```text
Web ↔ Landing
```

El design note existente propone:

- `source: web | landing`;
- root directories independientes;
- manifiesto allowlist para `apps/landing`;
- endpoint dev de streaming read-only;
- escritura y trash separados.

Design note:

```text
docs/superpowers/specs/2026-07-18-theme-builder-landing-section-design.md
```

No mezclarlo con el trabajo runtime ya cerrado.

### Duplicados por hash

Detectar assets idénticos utilizados desde distintas rutas y presentar candidatos a consolidación.

### Multi-theme

Fase mayor:

- múltiples themes completos;
- theme activo;
- selector en Account;
- persistencia;
- packs;
- monetización;
- registry data-driven.

No es necesario para continuar reemplazando DEFAULT/PRO en `candy-forest`.

### Resize por slot

Generar assets a dimensiones ideales cuando se definan formalmente los tamaños objetivo.

## 16. Punto exacto de reanudación

En una futura sesión, antes de modificar esta línea:

1. Leer este handoff.
2. Leer `docs/handoffs/2026-07-18-theme-builder-catalog-handoff.md` solo si se necesita contexto histórico del control plane.
3. Revisar los commits indicados.
4. Ejecutar las suites de themes y entitlement.
5. Verificar el invariante de cobertura `151/151`.
6. Confirmar que no reaparecieron consumers hardcoded.
7. Probar una wallet PRO en Learn, Play y Coach.
8. Confirmar que START FOCUS sigue apuntando a Exercises.
9. Preservar los fixtures del worktree descritos en la sección 14.

La siguiente tarea no debe comenzar reauditando desde cero el Theme Builder. La foundation actual se considera estable.

## Cierre

**Estado final: ✅ DONE**

Chesscito cuenta ahora con un sistema funcional para:

```text
Catalogar arte
→ administrar DEFAULT/PRO
→ crear overrides faltantes
→ conectar todos los consumidores activos
→ reaccionar al entitlement MiniPay
→ preservar navegación y accesibilidad
```

El alcance actual queda cerrado y listo para que el founder continúe diferenciando visualmente la experiencia PRO de forma progresiva.
