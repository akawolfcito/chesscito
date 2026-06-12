# Handoff — Perf wave 2 close + JS cluster NEXT (2026-06-13)

## Resume entry point

> **On "continuaré": el objetivo es ANALIZAR el cluster JS de /arena — NO implementar.**
> El founder quiere primero validar si diferir wagmi/RainbowKit es realmente bueno y que no
> rompería nada. Entregable de la próxima sesión: spec + análisis de riesgo/beneficio con
> evidencia (qué chunks, qué consumers, qué se difiere, plan de smoke), y SOLO con su go
> se implementa. Leer §"Caso de negocio JS" abajo + memorias `arena-play-timer-fragility`,
> `hook-ref-stability`, `sign-routes-labyrinth-env-fix`.

## Estado del app al cierre (todo live en prod, `main` = `production` = `56bb7339`)

| Ruta | Score móvil | Estado |
|---|---|---|
| `/` landing | 86 | LCP registra post fade-fix; sin necesidad de preload |
| `/hub` | 85 oficial (PSI founder) | imagen-óptimo; resto es JS |
| `/exercises` | 83 (era 55) | imagen-óptimo |
| `/arena` | 72 | **imagen-PERFECTO (Load Delay 0, Load Time 0) pero JS-bound: Render Delay 4264ms** |

Suite 3660/3660 · VR verde sin refresh de baselines · arena-flow E2E 2/2 (reparado, estaba stale).

## Lo shipped esta ola (commits `0e821c18..56bb7339`)

- `0e821c18` **fade-in-5 en template.tsx** — cierra el NO_LCP intermitente (paints a opacity 0 no
  emiten candidato LCP; validado 5/5 corridas + landing). Test `template.test.tsx` lo ancla.
- `b28033db` **@vercel/analytics removido** — WA off en dashboard ⇒ script.js 404 en cada visita
  (lo flageó el PSI del founder en Best Practices). Re-add = 2 líneas + toggle dashboard.
- `15160915` **§6.1 appendix en el packet MiniPay** — PSI oficial 85/93/96/63 con notas defensivas
  (SEO 63 intencional por noindex del app shell; user-scalable=no es decisión de gestos).
  **Packet COMPLETO — solo falta que el founder devuelva el form.**
- `2fe71982` **width/height en guide-secuencia** (PSI CLS audit; CLS ya era 0, es seguro).
- `56bb7339` **preload bg-ch en /arena** vía `arena/layout.tsx` server NUEVO (page.tsx frágil
  intocada) + **repair del arena-flow spec** (soft-gate modal `10f62c88` + CTA "PLAY").

## Triage PSI que quedó decidido (no re-litigar)

- Portal/avatar "oversized": **falso positivo DPR** (PSI compara CSS px ignorando ~1.75-2x físico).
- Legacy JS 12KB: polyfills core Next 14; no rentable.
- Unused CSS 40KB: NO es purga Tailwind (JIT ya activo) — es el `globals.css` de 12k líneas
  artesanales viajando a todas las rutas. Fix real = split por superficie vía CSS imports de
  componente (los prefijos `.arena-*`/`.playhub-*` lo hacen mecánico) o `experimental.optimizeCss`.
  Empaquetar con el cluster JS (misma red VR).
- Preload = bisturí, no vitamina: solo donde la medición muestre Load Delay alto (regla aplicada
  3 veces: hub portal, hub daily icon, arena bg).

## Caso de negocio JS (para el análisis de la próxima sesión)

/arena post-preload: LCP 5.6s = TTFB 1.3s + **Render Delay 4.3s**. La página entera es client
component; el contenido no pinta hasta bajar/ejecutar ~603KB de JS (wagmi/RainbowKit ~107KB
unused según PSI, motor de ajedrez, etc.) e hidratar. /hub tiene el mismo techo en menor grado
(464KB). Preguntas que el análisis debe responder ANTES de tocar código:

1. ¿Qué hay exactamente en los 3 chunks grandes? (`6427`, `3446`, `1fa7ebf3` — correr
   `ANALYZE=true pnpm build` o bundle-analyzer)
2. ¿Quién consume `WalletProvider`/`wagmiConfig` en el primer render de cada ruta? (hub scaffold
   usa `useAccount/useReadContracts/useConnectModal` — el defer NO puede romper zero-click MiniPay)
3. ¿Se puede diferir RainbowKit (solo UI de modal) sin tocar wagmi (estado de conexión)?
   RainbowKitProvider ya es dynamic ssr:false — ¿qué más arrastra el chunk?
4. ¿El arena select (difficulty/color) puede ser server/static shell con el juego diferido?
5. Plan de validación: arena-flow E2E (ya verde), smoke MiniPay zero-click, VR, y las memorias
   de fragilidad. Medir burden real en dispositivo (no solo LH).

Riesgos documentados: `arena-play-timer-fragility` (400ms timer, effects con refs inestables lo
matan), `hook-ref-stability`, zero-click MiniPay (`WalletProviderInner` auto-connect), pre-launch
pero prod es snapshot estable del founder.

## Pendientes fuera de perf (sin cambio)

- Founder devuelve el form MiniPay (packet listo).
- /arena tiene `?fresh=1` convention — cualquier refactor de arena debe respetar los 9 callsites.
- Backlog: nickname onboarding (SIWE-style), geo+retention self-built, economía narrativa,
  Slice 5 mastery, laberintos ricos.

## Lecciones de proceso de esta ola

- E2E specs stale se disfrazan de regresiones: arena-flow llevaba ~12 días rojo (modal soft-gate
  + rename CTA) y nadie lo notó hasta que un cambio cercano obligó a correrlo. Si un spec falla,
  primero `git stash` + re-run para bisectar.
- Los watchers `until grep` deben incluir palabras que el log realmente emite (zombie de 1h16m).
- `kill %1` no funciona entre invocaciones Bash separadas — matar por puerto (`lsof -ti :PORT`).
