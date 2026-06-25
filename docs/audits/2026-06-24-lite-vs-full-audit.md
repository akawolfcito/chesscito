# Auditoría Técnica: Chesscito Lite vs. Chesscito Full

**Fecha:** 2026-06-24  
**Commit base auditado:** `main` — `4f26019e`  
**Propósito:** Separar narrativas antes de reunión con MiniPay. Sin implementar cambios.

---

## Mecanismo de separación

Un único flag de compilación controla qué versión se sirve:

```
NEXT_PUBLIC_CHESSCITO_LITE_MODE=true   → Chesscito Lite
NEXT_PUBLIC_CHESSCITO_LITE_MODE=false  → Chesscito Full (default)
```

**Archivo fuente:** `src/lib/feature-flags.ts:1`

El middleware (`src/middleware.ts:57`) redirige `307 → /hub` cualquier path bloqueado en Lite.  
**Paths bloqueados en Lite** (`src/lib/lite-mode-routing.ts:1–8`):
`/arena`, `/coach`, `/victory`, `/shop`, `/pro`, `/founder`

`.env.local` tiene `NEXT_PUBLIC_CHESSCITO_LITE_MODE=true` → el entorno de desarrollo local corre en modo Lite.  
`.env` (Vercel prod) no tiene la variable o la tiene en `false` → Full es el default de producción.

---

## 1. Tabla de funcionalidades

| Funcionalidad | Lite / Full / Compartido | Estado | Archivos relevantes | Evidencia |
|---|---|---|---|---|
| **Hub (pantalla de inicio)** | Compartido | Real | `app/[locale]/hub/page.tsx`, `components/hub/hub-scaffold.tsx` | Ambos modos montan `/hub`. Lite quita PRO badge y Peones chip. |
| **Focus Passport (streak visual)** | Lite-only | Real | `components/hub/focus-passport.tsx`, `hub-scaffold.tsx:288` | Solo renderiza si `CHESSCITO_LITE_MODE && focusPassport`. Full muestra pawn+guide+king. |
| **Daily Tactic** | Compartido | Real | `app/[locale]/challenge/daily/`, `components/daily/daily-tactic-sheet.tsx` | Compartido en código; Lite oculta secciones de score-on-chain (`!CHESSCITO_LITE_MODE:183,200`). |
| **Limit diario en Ejercicios** | Lite-only | Real | `components/daily/daily-limit-guard.tsx`, `exercises/page.tsx` | Gate soft muestra banner en Lite; Full no limita. |
| **Ejercicios (piezas)** | Compartido | Real | `app/[locale]/exercises/page.tsx`, `components/exercises/exercises-screen.tsx` | Deck de 60 ejercicios compartido. Lite bloquea sheets `shop` y `pro`. |
| **Laberintos** | Compartido | Real | `components/exercises/labyrinth-complete-overlay.tsx`, `api/sign-labyrinth/` | Mecánica compartida. Lite puede reclamar badges on-chain (ver nota). |
| **Badge claim (laberintos)** | Compartido (activo en Lite) | Parcial | `lib/game/context-action.ts:57–60` | `submitScore` suprimido en Lite; `claimBadge` preservado. Requiere `LABYRINTH_BADGES_ADDRESS` desplegado. |
| **Score save on-chain** | Full-only | Real en Full | `lib/game/context-action.ts:40`, `api/scores/save/`, `api/sign-score/` | `submitScore` suprimido en Lite (`liteMode:true`). En Full: firma + Scoreboard en mainnet `0x1681aA...`. |
| **Arena (PvAI)** | Full-only | Real | `app/[locale]/arena/page.tsx` | Middleware redirige `/arena → /hub` en Lite. Contrato Scoreboard activo en Full. |
| **Victory NFT** | Full-only | Real | `app/[locale]/victory/[id]/`, `api/sign-victory/`, `api/games/[id]/mint-receipt/` | Middleware bloquea en Lite. Contrato `0x0eE22F83...` desplegado en mainnet. |
| **Coach (IA análisis)** | Full-only | Parcial | `app/[locale]/coach/`, `api/coach/analyze/`, `hub-scaffold-client.tsx:581` | Middleware bloquea `/coach` en Lite. `NEXT_PUBLIC_ENABLE_COACH=false` en template (prod desactivado por flag). Solo activo en `.env.local`. |
| **Coach Credits** | Full-only | Parcial | `api/coach/credits/`, `api/coach/verify-purchase/` | No existe en Lite. En Full: requiere Coach habilitado + Supabase. |
| **Tienda / Shop** | Full-only | Real | `components/exercises/exercises-screen.tsx:3165`, `hub-scaffold-client.tsx:648` | `!CHESSCITO_LITE_MODE` guarda `<ShopSheet>` en ambas superficies. Contrato `0x24846C77...` en mainnet. |
| **Peones (moneda interna)** | Full-only (visible) | Real backend / Oculto en Lite | `components/hub/hub-scaffold.tsx:222`, `api/peones/` | `PeonesBalanceChip` oculto en Lite. Backend earn/spend/balance compartido. Peones se acumulan en Lite vía earn silencioso (no visible al usuario). |
| **PRO (membresía)** | Full-only | Real | `app/[locale]/hub/page.tsx`, `components/hub/hub-scaffold.tsx:239`, `api/pro/status/` | `HubProBadge` y `ProSheet` ocultos en Lite (`!CHESSCITO_LITE_MODE`). Middleware bloquea `/pro`. |
| **Cards (ChesitoCard)** | Full-only | Real | `exercises-screen.tsx:299` | `{!CHESSCITO_LITE_MODE && <ChesitoCard />}` — no existe en Lite. |
| **Badges (Scoreboard)** | Compartido | Parcial | `api/sign-badge/`, `components/exercises/trophies-sheet.tsx` | Sheet accesible en ambos. Badge on-chain requiere wallet conectada y contrato `0xf92759E5...`. |
| **Trophies** | Compartido (contenido diferente) | Real | `app/[locale]/trophies/page.tsx`, `components/trophies/trophies-body.tsx` | En Lite: muestra logros derivados de `dailyProgress` (localStorage). En Full: victorias on-chain + HoF. Textos condicionados por flag. |
| **Stats / Perfil** | Compartido | Parcial | `components/profile/general-stats.tsx:25`, `components/profile/profile-sheet.tsx:351` | Lite filtra celdas `fullOnly`. PRO row oculto. |
| **Share (social)** | Compartido | Real | `app/[locale]/share/daily/`, `share/score/`, `share/endgame/`, `share/badge/` | Rutas accesibles en ambos. Contenido varía por tipo de partida. |
| **Welcome Package** | Lite-only (activo) | Real | `lib/welcome-package/use-welcome-package.ts:34`, `api/welcome-pack/claim/` | Solo activo si `CHESSCITO_LITE_MODE`. Requiere wallet + Supabase + Upstash Redis. |
| **Leaderboard** | Full (visible) / Compartido (datos) | Real | `api/leaderboard/`, `api/hall-of-fame/` | Lite muestra HoF vacío de on-chain. Full muestra ranking por victorias. |
| **Content Loop / NextStepCard** | Lite-only | Real | `components/hub/next-step-card.tsx`, `hub-scaffold.tsx:341` | Solo renderiza si `CHESSCITO_LITE_MODE && nextStepCard`. |
| **Wallet connect** | Compartido (requerido en Full, opcional en Lite) | Real | `hub-scaffold.tsx:228` | Lite no requiere wallet para jugar. Full require wallet para Save/Claim/Arena. |
| **Navegación / Dock** | Compartido (ítems diferentes) | Real | `components/exercises/persistent-dock.tsx:131` | `SIDE_LEFT` usa ternario Lite vs Full. Dock Lite omite Shop/PRO. |

---

## 2. Tabla de transacciones

| Flujo | Lite / Full | Estado | Contrato/Red/Token | Archivo que lo dispara | Beneficio post-tx | Riesgo |
|---|---|---|---|---|---|---|
| **Compra Peones (ERC20 Transfer)** | Full-only | Parcial — fail-closed | Celo mainnet; cUSD/USDC/USDT; treasury `X` en prod | `api/verify-payment/route.ts` | +50 Peones en ledger Supabase | Treasury `=X` en `.env` → retorna `rail_not_configured 503`. No hay path de pago activo en producción/testnet. |
| **Compra ítems Shop (safeTransferFrom)** | Full-only | Real | Celo mainnet; USDC `0xcebA93...`; Shop `0x24846C...` | `components/payments/`, `api/verify-payment/` | Ítem acreditado en ledger | Treasury desactivada igual aplica; doble-gating Shop + treasury. |
| **Save Score on-chain** | Full-only | Real | Celo mainnet; Scoreboard `0x1681aA...` | `api/sign-score/`, `api/scores/save/` | Puntaje en Scoreboard, fila en `games` DB | Suprimido en Lite por `context-action.ts:40`. |
| **Mint Victory NFT** | Full-only | Real | Celo mainnet; VictoryNFT `0x0eE22F...` | `api/sign-victory/`, `games/[id]/mint-receipt/` | NFT en wallet; URL `share/victory` | Bloqueado en Lite por middleware. |
| **Claim Badge (Scoreboard)** | Compartido | Parcial | Celo mainnet; Badges `0xf92759...` | `api/sign-badge/`, ejercicios exercises-screen | Medalla on-chain | Requiere wallet. Activo en Lite si usuario conecta wallet. |
| **Claim Badge (Laberintos)** | Compartido (preservado en Lite) | Parcial | Celo mainnet; `LABYRINTH_BADGES_ADDRESS` = `0x0000...` en template | `api/sign-labyrinth/route.ts` | Badge de laberinto on-chain | `getLabyrinthBadgesAddress()` lanza si la var es `0x0000...` (placeholder). Estado real del address en Vercel no auditado. |
| **Welcome Pack claim** | Lite-only | Real | Sin tx on-chain — Supabase + Redis (Upstash) | `api/welcome-pack/claim/route.ts` | +N shields en Redis | Requiere wallet + Supabase + Upstash configurados. Falla si Upstash no está seteado. |
| **Earn Peones (daily tactic/lab/ejercicios)** | Compartido (silencioso en Lite) | Real | Sin tx on-chain — Supabase ledger | `api/peones/earn/route.ts` | +N Peones en ledger (no visibles al usuario Lite) | Peones se acumulan en DB sin UI para gastarlos en Lite. Potencial deuda de economía no reconciliada. |
| **Spend Peones (shields rescue)** | Full-only (activo en ambos via UseShield) | Real | Sin tx on-chain — Supabase | `api/shields/spend/`, `api/peones/spend/` | Vida extra en partida | Shields compartidos; el flujo de compra de shields pertenece a Full. |

---

## 3. Separación narrativa

### Qué es Chesscito Lite hoy (con evidencia)

Una experiencia **sin wallet requerida**, centrada en hábitos diarios y aprendizaje:

- **Hub limpio**: sin PRO badge, sin Peones chip, sin Coach tile (flag en `hub-scaffold.tsx:222,239,581`)
- **Focus Passport**: tracker de racha de 7 días con llamas (localStorage, no blockchain)
- **Daily Tactic**: ejercicio táctico diario resolvible sin wallet
- **Ejercicios de piezas**: 60 ejercicios base con limit diario suave (`daily-limit-guard.tsx`)
- **Laberintos**: mecánica accesible; badge claim on-chain disponible si el usuario conecta wallet
- **Trophies Lite**: logros derivados de localStorage (racha, días completados), no victorias on-chain
- **Content Loop**: `NextStepCard` que sugiere qué hacer a continuación (`hub-scaffold.tsx:341`)
- **Welcome Package**: acredita shields vía Supabase al conectar wallet por primera vez
- **Progreso local**: `localStorage` como fuente de verdad para hábito; sin backend de progreso propio

### Qué NO debería prometer Chesscito Lite

- **Peones como economía visible**: se acumulan silenciosamente en Supabase pero no hay UI de gasto en Lite. No prometerlos como recompensa tangible hasta que la UI exista.
- **Badges on-chain garantizados**: el address de laberinth badges puede ser placeholder en producción. Verificar antes de demo.
- **Coach**: completamente bloqueado en Lite (middleware + flag).
- **Arena PvAI**: redirigida a `/hub` por middleware.
- **PRO**: no existe en Lite. Ningún elemento lo menciona en Lite.
- **Tienda / Shop**: bloqueada en Lite (UI y middleware).
- **Victory NFTs**: bloqueados en Lite (middleware).
- **Score on-chain**: suprimido en `context-action.ts` incluso si el usuario tiene wallet.

### Qué es Chesscito Full hoy (con evidencia)

Una plataforma de juego completa con economía on-chain en Celo mainnet:

- **Arena PvAI**: partidas contra IA con dificultad Easy/Medium/Hard, timer, Scoreboard on-chain (`0x1681aA...`)
- **Coach IA**: análisis post-partida vía LLM (GPT-4o-mini o equivalente); requiere créditos
- **Tienda**: 4+ ítems comprables con stablecoins (USDC/cUSD/USDT) vía Shop contract `0x24846C...`
- **Peones**: economía off-chain visible (balance chip, earn por partida/daily, spend en shields)
- **PRO**: membresía con sesiones incluidas de Coach, badge PRO, acceso a funciones premium
- **Victory NFTs**: minteo de victorias como NFTs en contrato `0x0eE22F...`
- **Score on-chain**: registro de puntaje en Scoreboard con firma server-side
- **Leaderboard**: ranking por victorias on-chain + Hall of Fame
- **Cards / ChesitoCard**: componente visible en exercises (Full-only)

### Qué NO debería prometer Chesscito Full todavía

- **Rail de pagos activo en producción**: `CHESSCITO_TREASURY_ADDRESS=X` en `.env` (prod) → payment rail desactivado intencionalmente. Ningún usuario puede comprar Peones con stablecoins hoy en prod.
- **Coach en producción**: `NEXT_PUBLIC_ENABLE_COACH=false` en template y prod. Solo activo en `.env.local`.
- **Labyrinth Badges address estable**: `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS=0x0000...` en template — revisar si está configurado en Vercel prod.
- **Economía de Peones cerrada**: hay earn (daily, labs, ejercicios) y spend (shields), pero la compra de Peones con stablecoins está fail-closed en prod.

---

## 4. Recomendación para MiniPay

### Opción recomendada: Presentar Lite como entrada + Full como roadmap

**Por qué:** Lite es la narrativa más honesta y defendible hoy. Está completa como producto de hábito cognitivo, sin dependencias de pago activas, sin Coach (que necesita config en prod), y sin el rail desactivado. Full existe y tiene contratos desplegados en mainnet, pero el rail de pagos y el Coach no están activos en producción — presentarlos en demo es un riesgo de credibilidad.

### Demo flow recomendado (Lite)

1. **Abrir en MiniPay mobile (390px)**  
   → Hub Lite: Focus Passport con llamas de racha, tiles de Daily + Exercises
2. **Tap "Daily Practice"**  
   → Daily Tactic: resolver una táctica corta; muestra resolución, streak actualizado
3. **Tap "Exercises" (o desde NextStepCard)**  
   → Seleccionar Torre; resolver 2-3 ejercicios; mostrar labyrinth si está disponible
4. **Tap Trophies**  
   → Logros Lite: días completados, racha, primer ejercicio completado (sin victorias on-chain)
5. **Volver al Hub**  
   → Focus Passport actualizado mostrando progreso del día

### Pantallas a mostrar

| Pantalla | Mostrar | Nota |
|---|---|---|
| Hub Lite (Focus Passport) | ✅ | Core de la narrativa de hábito |
| Daily Tactic | ✅ | Loop diario central |
| Exercises (Torre) | ✅ | Aprendizaje de pieza |
| Labyrinth | ✅ | Reto corto; badge opcional |
| Trophies Lite | ✅ | Logros sin on-chain complejo |
| Share daily | ✅ | Viral loop limpio |
| Arena | ❌ | Redirige a Hub en Lite |
| Coach | ❌ | No activo en prod |
| Shop | ❌ | Bloqueado en Lite |
| PRO badge / flow | ❌ | Oculto en Lite |

### Qué decir si preguntan por monetización o transacciones

> "Chesscito Full tiene contratos desplegados en Celo mainnet — Scoreboard, Shop, Victory NFTs — con soporte para pagos en USDC/cUSD. El rail de pagos existe y está implementado; hoy está configurado en modo inactivo hasta que confirmemos el modelo de negocio final. La versión Lite que presentamos hoy es gratuita por diseño: el engagement viene del hábito diario, no de una transacción. La monetización llega en la siguiente fase con la tienda y las membresías PRO."

---

## 5. Cambios mínimos antes de la reunión

Los siguientes cambios son de visibilidad/ocultamiento, no de funcionalidad. Ninguno requiere modificar contratos ni backend.

| Ítem | Problema actual | Acción mínima | Archivo | Urgencia |
|---|---|---|---|---|
| **HubDailyTile visible en Lite** | El tile Daily en el rail derecho emite eventos y lógica de streak; correcto y limpio. | No tocar — está bien. | `hub-daily-tile.tsx` | Sin acción |
| **Peones earn silencioso en Lite** | Peones se acumulan en Supabase sin UI visible. Si preguntan, es inconsistencia no explicada. | Documentar como "economía latente que activa Full". No suprimir el earn (daña DB). | `api/peones/earn/` | Bajo — solo narrativo |
| **Labyrinth badge address** | `NEXT_PUBLIC_LABYRINTH_BADGES_ADDRESS` puede ser `0x0000...` en Vercel Lite. El badge claim fallará en demo. | Verificar en Vercel env que el address esté configurado, o suprimir badge claim en Lite via flag adicional si no está listo. | `api/sign-labyrinth/route.ts`, `.env` en Vercel | Alto si van a demostrarlo |
| **Coach tile visible en hub-action-rail** | El código tiene `onCoachTap={CHESSCITO_LITE_MODE ? undefined : ...}` — si `undefined`, el tile no renderiza. | Verificar que el tile no aparezca en Lite. **Ya está gated correctamente** (`hub-scaffold.tsx:384–402`). | `hub-scaffold.tsx:384` | Confirmar en device |
| **Arena tile visible en hub-action-rail** | `HubArenaTile` renderiza en Lite aunque tocarla navega a `/arena` que redirige. Puede confundir. | Evaluar ocultar `HubArenaTile` en Lite o dejar la redirección como está (usuario ve hub → no confunde). | `hub-scaffold.tsx:381` | Medio — estético |
| **`?sheet=shop` URL en Lite** | Si alguien llega con un URL con `?sheet=shop`, el código lo suprime (`exercises/page.tsx:53`). | Ya está gated. Sin acción. | `exercises/page.tsx:53` | Sin acción |
| **Dev routes accesibles** | `/dev/*` y `/lite-debug/*` son accesibles si se sabe la URL. | Confirmar que Vercel no los expone en la URL demo o agregar auth básica. | `middleware.ts:74–79` | Bajo — solo en demo controlado |

---

## Conclusión

**Narrativa honesta y defendible para MiniPay:**

Chesscito Lite es un producto funcional y completo hoy como entrenador de hábitos cognitivos vía Daily Tactic + Ejercicios + Laberintos + Focus Passport. No requiere wallet, no tiene pagos, y el engagement es medible por localStorage/Supabase. El código de Full está en el mismo repo, separado por un flag de compilación, con contratos reales desplegados en Celo mainnet — el camino al monetization es claro y técnicamente sólido, pero honestamente no está activado en producción todavía.

**Riesgo principal si se mezclan las narrativas:** El payment rail, el Coach y las Victory NFTs existen en el código pero no están activos en prod. Presentarlos como "live" en una reunión con MiniPay y luego no poder demostrarlo crearía una brecha de credibilidad innecesaria.
