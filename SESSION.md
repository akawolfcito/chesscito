# Session Handoff — 2026-07-27

## Completed
Cluster: **ChallengeCard del hub LEARN** redistribuida a la gramática de `KingdomCard`, y
un diagnóstico completo del estado del VR (que resultó ser otra cosa de la que creíamos).

- [ `fb6d9f4` ] refactor(challenge-card): la semana de 7 llamas sale de la columna del
  ícono y pasa a ser hermana del header → ancho completo (antes ~250px a 390px). El
  ordinal se une al streak en una frase; la letra del día va arriba de su llama; la fila
  de stats gana el hairline de `kingdom-card-benefits`.
- [ `c08fa48` ] fix(art): `bg-wallpaper-lite` estaba desincronizado entre `apps/web` y
  `apps/landing` desde `92a016e8`. **Era un job de CI en rojo** (`asset-drift`).
- [ `de674e2` ] refactor(hub-tour): el spotlight del paso `challenge` pasa del panel
  entero al `.challenge-card-cta-row`. La fila y NO el botón: la flecha es hermana del
  botón y su regla CSS es de descendiente.
- [ `ae47863` ] refactor(challenge-card): "21 days" se retira al inscribirse. Gateado, no
  borrado: es el único consumidor de `hub.focus-passport-calendar` y `theme:coverage` es CI.

## Current State
- **Branch**: `feat/challenge-card-redistribution`, 4 commits, **sin pushear**. `main`
  local sigue en `275f75da`.
- **Build**: suite `5903 passing / 522 files`, exit 0 verificado, 0 `Unhandled Errors`;
  `tsc --noEmit` limpio; los 3 guards de `asset-drift` en verde.
- **Verificación visual**: el founder revisó HUB LEARN en dispositivo → correcto.
- **Uncommitted work**: ninguno.

## Next Tasks
Orden y detalle completo en `docs/handoffs/2026-07-27-challenge-card-and-vr-handoff.md`.

1. **Refactor `HubLiteScaffold` → `dailySlot: ReactNode`** (el mismo que PLAY ya tuvo).
   Bloquea todo lo demás: hoy el scaffold monta `HubDailyTile`, que llama `useAccount()`,
   así que un probe `/dev` de LEARN renderiza un error overlay.
2. `/dev/learn-hub` + `vr18-learn-hub-*`, espejando `/dev/play-hub`.
3. `hub-clean` → `exercises-clean` + `mask` sobre tablero y objetivo.
4. Regenerar `vr9`–`vr17` (~39 fotos) revisando una por una.

## Blockers
- Ninguno técnico. El refactor del punto 1 toca 3 containers + tests: se dejó para
  empezar en frío, no al final de una sesión larga.

## Notes
- **CI NO corre Playwright.** Jobs: `web-tests`, `type-check`, `asset-drift`,
  `contract-tests`. Los baselines VR no ponen rojo el CI — el pendiente que arrastraba el
  `SESSION.md` anterior era falso.
- **Para correr VR local**: `BASE_URL=http://localhost:3002 PORT=3002` — si no, la app
  pinta el banner `DEV: PRO origin mismatch` y todas las fotos salen con el cartel encima.
- **`hub-clean` no fotografía el hub**: navega a `/exercises`. El nombre heredado nos hizo
  razonar mal dos veces. No borrarlo — es la única cobertura VR de la pantalla de juego.
- **Regla nueva a instalar**: el VR nunca debe leer contenido autorado. El catálogo va a
  cambiar seguido por diseño (ejercicios y juegos lúdicos que se agregan y se sacan); las
  fotos van contra probes `/dev` con props fixture, como ya hace `vr17`.
- Decisiones de producto cerradas esta sesión (CTA sin chevron, sin "Challenge Badges",
  theme como reveal post-compra): en el spec, §"Descartado en la misma revisión".
