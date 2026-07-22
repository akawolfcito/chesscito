# Auditoría — Visibilidad de la economía de Peones (Fase 1)

**Fecha:** 2026-07-21 · **Estado:** diagnóstico, sin implementar
**Alcance:** cerrar el loop `ganar → ver → gastar → entender`, sin XP, niveles ni moneda nueva.

---

## 1. Dónde se renderiza cada recurso

| Recurso | Componente | Familia visual | Dónde se monta |
|---|---|---|---|
| Streak / Stars / Shields | `components/hud/hud-secondary-row.tsx:30` → `hud-resource-chip.tsx:53` | `.hud-resource-chip` | **Solo** `hub-scaffold.tsx:252` |
| Peones | `components/peones/peones-balance-chip.tsx:225` | `.candy-tray-pill.hub-hud-pill` (**otra familia**) | **Solo** `hub-scaffold.tsx:209` |
| "Combo" | `exercises/exercise-drawer.tsx:231` (asset `exercises.combo`) | — | drawer de ejercicios |

**Hallazgo A — el Peón no está en el HUD.** `HudSecondaryRow` conoce streak/stars/shields y
**no tiene slot de Peones**. El chip de Peones es un componente aparte, con otra clase CSS, montado
como hermano en el mismo scaffold. No hay una fila única "recursos".

**Hallazgo B — el saldo solo existe en `/hub`.** Ninguna de las superficies donde se **gasta**
(`/exercises`, `/coach`, rescate por shield) monta chip de saldo. El prop `surface` del chip existe
justamente para eso y nadie lo usa (`peones-balance-chip.tsx:46`, comentario: *"un cluster futuro
puede montarlo en /exercises, /coach o /arena sin cirugía"*).

---

## 2. Superficies que ganan o gastan

### Earn (`POST /api/peones/earn`)
| Fuente | Wrapper | Callers |
|---|---|---|
| Daily Tactic (**1 Peón**, era 3) | `lib/daily/peones-earn.ts:100` · `DAILY_TACTIC_EARN_AMOUNT` línea 28 | `daily-tactic-slot.tsx:133`, `hub-daily-tile.tsx:179` |
| Hito de ejercicios | `lib/peones/training-earn.ts:89` | `hooks/use-exercise-progress.ts:518` |

### Spend (`POST /api/peones/spend`)
Tabla canónica **`lib/peones/spend-service.ts:51`** — el servidor es la única fuente de verdad y
valida el `amount` del cliente:

```ts
coach: 10,   hint: 2,   shield: 5
```

**Los tres costos del slice pedido ya coinciden con la tabla canónica.** No hay drift que corregir;
falta *mostrarlos*.

| Sink | Orquestador | Notas |
|---|---|---|
| Hint | `components/peones/peones-hint-button.tsx:179` | único sink con UI propia |
| Coach | `lib/peones/coach-spend-fallback.ts:89` | ribbon de costo en `coach/coach-cost-ribbon.tsx` |
| Shield rescue | `lib/peones/shield-spend-fallback.ts:86` ← `lib/exercises/use-fail-rescue.ts:213` | **fallback**: solo se paga con Peones si `/api/shields/spend` da 409 y `shieldsCount === 0` |
| Compra de pack | `ChesitoCard` (`components/peones/chesito-card.tsx`) | rail de compra; es **source**, no sink |

`retry` y `save_game` fueron **retirados** en Economy V1 (`spend-service.ts:27-34`): hoy son gratis.

---

## 3. Cómo se actualiza el balance hoy

**No hay React Query para Peones.** React Query existe en el repo (`lib/pro/use-pro-status.ts:72`)
pero `usePeonesBalance` (`lib/peones/use-peones-balance.ts:55`) es `useState` + `useEffect` a mano:

- Fetch en mount y cuando cambia `isConnected`/`address`. **Sin intervalo, sin caché compartida.**
- Se instancia **4 veces por separado**, cada una con su propio estado:
  `learn-hub-client.tsx:140`, `play-hub-client.tsx:45`, `chesito-card.tsx:40`, `peones-balance-chip.tsx:226`.
- El docblock lo dice explícito (líneas 19-25): *"Los flujos de earn NO llaman refetch — dependen de
  la escritura server-side y del próximo mount del chip"*.
- `PeonesHintButton` declara *"NEVER mutates global balance cache"* (línea 28).

**Hallazgo C — causa raíz del problema del usuario.** Nada notifica un cambio de saldo. Después de
un earn o un spend, el chip del hub sigue mostrando el número viejo hasta que se desmonte y remonte.
El único refetch que existe se dispara al cerrar la Chesito Card (`peones-balance-chip.tsx:139`).

**Hallazgo D — el patrón que falta ya está inventado en el repo.** Hay cinco event-buses idénticos
(`CustomEvent` en `window` + wrapper de subscribe):
`lib/shop/shield-events.ts`, `lib/daily/events.ts`, `lib/daily/session-events.ts`,
`lib/exercises/use-streak.ts:50`, `lib/welcome-package/welcome-package-events.ts`.
**No existe `lib/peones/peones-events.ts`.** Los shields ya resuelven exactamente este problema con
`dispatchShieldChange()` (`use-fail-rescue.ts:205`).

---

## 4. La regla exacta del Hint

Render único: `exercises-screen.tsx:3448`, en `actionRowCenter`.

```ts
activeLabyrinth || phase !== "ready" || CHESSCITO_LITE_MODE ? null : <PeonesHintButton ... disabled={false} />
```

- `phase` es `"ready" | "success" | "failure"`, arranca en `"ready"` (`exercises-screen.tsx:416`).
  → **Sí está visible durante todo el intento**; desaparece al resolver o fallar. Eso es correcto.
- `disabled` **siempre se pasa `false`**. La prop existe pero nadie la usa.
- **No depende** de errores previos, dificultad, ni pieza. No hay desbloqueo por intento fallido.

**Hallazgo E — por qué "casi no aparece":**
1. Solo vive en el flujo clásico de `exercises-screen`. **No se monta en labyrinth ni en ningún juego
   firma del carril 2** (safe-path, promotion-run, queens son componentes de tablero aparte).
2. Nunca se monta en Chesscito Lite.
3. Invitado = pin gris al 50% de opacidad, sin texto de costo (`peones-hint-button.tsx:141`).

**Hallazgo F — el costo del Hint es invisible.** `editorial.ts:3711`:
`button: "Hint · 2 Peones"` se usa **solo como `aria-label`**; lo que se ve es
`pinLabel: "Hint"`. Un usuario vidente nunca ve el precio antes de pagar.

**Hallazgo G — defecto real: se puede pagar y no recibir nada.** El "contenido" del hint no es texto
autoral: es `firstStep`, calculado por BFS y pintado como glow en el tablero. Si el BFS falla,
`peones-hint-button.tsx:238-241` **cobra igual**:

> *"Si firstStep es null (BFS falló / irresoluble) igual acreditamos el gasto y mostramos el estado
> revealed — el jugador simplemente no recibe pista visual, lo cual es raro y no justifica un refund."*

Esto es cobrar 2 Peones por nada. **Es el único hallazgo que recomiendo tratar como bug, no como UX.**

---

## 5. ¿Hay componente reutilizable de toast / feedback?

**No hay uno genérico.** Hay tres toasts *ad hoc*, cada uno con props propias y sin API compartida:

- `coach/mint-success-toast.tsx:22` — `{ tokenId, onDismiss }`
- `arena/claim-cancelled-toast.tsx:22` — `{ onDismiss }`
- `connect-prompt/connect-prompt-toast.tsx:31` — `{ milestone, onConnect, onDismiss }`
- `TxProgressSteps variant="toast"` — específico de transacciones on-chain

Sí existe un primitivo de "cambio de valor" reutilizable: **`HudResourceChip` ya anima el delta**
(`hud-resource-chip.tsx:69-97`): pulso de 240ms al cambiar, y `pulseDamageOnDecrement` para pintar
un decremento en rojo. Es exactamente el feedback "gastaste" sin construir animación nueva.

---

## 6. Slice MVP propuesto

Orden por dependencia. Cada punto = un commit atómico.

**1. `lib/peones/peones-events.ts` (nuevo, ~24 líneas).** Copia literal de `shield-events.ts`:
`dispatchPeonesChange()` / `subscribeToPeonesChanges()`. Es la única pieza de estado nueva, y
reemplaza estado, no lo duplica.

**2. `usePeonesBalance` se suscribe al bus.** Un `useEffect` que llama `refetch` en el evento. Con
esto las 4 instancias existentes convergen sin introducir React Query ni un provider global.
→ *cierra Hallazgo C y el requisito de "no divergir"*.

**3. Los 3 sinks + los 2 earns disparan el evento tras confirmar.** En `peones-hint-button.tsx`
(rama `result.kind === "success"`), `coach-spend-fallback.ts`, `shield-spend-fallback.ts`,
`peones-earn.ts`, `training-earn.ts`. **Solo en la rama de éxito** → nunca hay éxito optimista.

**4. Saldo visible en `/exercises` — punto de inserción exacto.**

⚠️ **Corrección al plan inicial.** En `/exercises` **no existe `HudSecondaryRow`**. Estrellas,
escudos y combo son **una sola pill compuesta**: el `SheetTrigger` del `ExerciseDrawer`
(`exercise-drawer.tsx:204-237`), con dividers internos. Y es condicional:
shields solo si `shieldCount > 0` (línea 219), combo solo si `streakCount >= 2` (línea 228).

La fila vive en `mission-panel-candy.tsx:613-625`, **directamente encima del tablero**
(`board-stage-focus`, línea 674):

```tsx
<div className="flex items-center gap-1">
  <div className="flex-1 min-w-0">{/* PiecePickerTrigger */}</div>
  <div className="shrink-0 min-w-[4.5rem]">{exerciseDrawer}</div>   {/* ★ | 🛡 | combo */}
  {/* ← aquí entra el chip de Peones */}
</div>
```

**El cambio es agregar un tercer slot `shrink-0` a esa fila existente**, alimentado por prop
(igual que `exerciseDrawer` ya lo está) para que `mission-panel-candy` siga siendo fotografiable
sin WagmiProvider. `exercises-screen.tsx` pasa `<PeonesBalanceChip surface="exercises" />`.

Reutilización total: `PeonesBalanceChip` **ya usa la misma familia visual** que esa fila
(`candy-tray-pill hub-hud-pill`), ya tiene el prop `surface` previsto para esto, y ya lee el
balance real vía `usePeonesBalance`. **No se crea componente, ni CSS, ni estado nuevo.**

*Mobile (390px):* al sumarse a una fila **existente**, el coste vertical para el tablero es
**cero** — no se agrega renglón. La compresión cae sobre `PiecePickerTrigger` (`flex-1`, tiene
`showLabel` reducible). Es el único riesgo de layout y se valida con VR en viewport móvil.

**5. NO tocar `HudSecondaryRow` ni `/hub`.** El punto 4 original (slot de Peones en el HUD del hub)
**se cae del slice**: el hub ya muestra el saldo y el pedido es `/exercises`. Menos alcance.
`/coach` ya tiene su `coach-cost-ribbon`; tampoco se toca.

**6. Costo visible en el Hint.** `pinLabel: "Hint"` → mostrar `♟ 2` junto al pin. Un cambio de copy
+ un span. `insufficient: "Need 2 Peones"` ya existe y ya es cost-explicit.

**7. Fix del Hallazgo G.** Si `firstStep == null`, **no cobrar**: chequear antes de `submit()` y
renderizar el estado deshabilitado con razón. Evita el cobro sin entrega.

### Fuera del slice (confirmado)
XP, niveles, historial de transacciones, animaciones grandes, rediseño de HUD, cambios a la
migración Peones V1, fuentes/sinks nuevas, hints para todos los ejercicios, montar el Hint en los
juegos del carril 2.

---

## 7. Red-team del propio plan

| Riesgo | Veredicto |
|---|---|
| ¿El bus duplica estado? | No. Es una señal sin payload; la fuente de verdad sigue siendo el endpoint. Alternativa (React Query global) es mucho más alcance. |
| ¿4 instancias → 4 fetches por evento? | Sí, 4 GET simultáneos al `/api/peones/balance`. En la práctica nunca hay 4 montadas a la vez (hub learn *o* play). Aceptable; si molesta, es un `dedupe` posterior. |
| ¿El punto 3 puede emitir en un duplicado idempotente? | Cuidado: en `hint`, `result.debited > 0` es true también en retry duplicado (ver `peones-hint-button.tsx:217-225`). El refetch igual es correcto (lee el saldo real), pero **el toast de "−2" no debe salir si `result.duplicate`**. |
| ¿Tocar `HudSecondaryRow` rompe VR? | El chip colapsa a `null` sin la prop → `/hub` no cambia salvo que se le pase. Requiere baseline VR nuevo solo en `/exercises`. |
| ¿El punto 7 cambia reglas económicas? | No. No cobrar por una entrega vacía no altera precios ni idempotencia. |
| ¿"Combo" entra al HUD? | No existe como recurso numérico; es un asset del drawer. **Fuera de alcance** — lo dejo así salvo indicación. |

---

## 8. Decisión previa en conflicto — y por qué el slice NO la viola

`exercises-screen.tsx:3305-3307` documenta una decisión explícita:

> *"Header = Account only. Peones lives inside the Account sheet now (Chesscito Card hero) — one
> wallet home, uncluttered header (**UX spec §6, 2026-07-06**)."*

Es decir: el saldo **fue quitado deliberadamente** de `/exercises` hace dos semanas.

**Por qué el slice es compatible.** Esa decisión aplica al `trailingControl` del `ContextualHeader`
— la zona **Z1 (identity chrome)**. El chip propuesto va al **quest tray (Z2, game context)**, y el
propio código declara que son zonas *"PHILOSOPHICALLY DIFFERENT"* que no deben agruparse
(`mission-panel-candy.tsx:604-612`): back/PRO/cuenta son chrome; los chips de recurso son contexto
de juego. Un saldo que se gana y se gasta jugando es **recurso de juego**, igual que estrellas,
escudos y combo — pertenece al tray, no al header.

El header sigue siendo "Account only". No se revierte la spec §6.

---

## 9. Criterios de aceptación (verificación visual, del founder)

1. Al entrar a `/exercises`, el saldo aparece **sobre el tablero**, en la fila del tray.
2. Estrellas, escudos, combo y Peones son legibles **simultáneamente en mobile (390px)**.
3. Tras un earn o un spend, el contador cambia **sin volver al Hub** (lo garantiza el bus del punto 2-3).
4. Recargar la página conserva el saldo correcto **desde la fuente de verdad** (`/api/peones/balance`;
   el hook no escribe localStorage, así que esto ya se cumple por construcción).

⚠️ Nota sobre el criterio 2: escudos solo se pintan con `shieldCount > 0` y combo con
`streakCount >= 2`. Para ver los cuatro chips a la vez hace falta una cuenta con racha ≥2 y ≥1
escudo — si no, el caso "cuatro simultáneos" no es observable.

---

## 10. Pregunta abierta (no bloquea el slice)

El Hint no existe en el carril 2 (safe-path, promotion-run, queens, labyrinth) ni en Lite. Llevarlo
ahí **sí es una vertical independiente** (cada juego tiene su propia noción de "mejor jugada" y
`computeExerciseBfs` no aplica). Mi recomendación: **dejarlo fuera** y que este slice solo arregle
visibilidad, costo y cobro-sin-entrega en el flujo clásico.
