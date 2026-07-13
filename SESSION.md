# Session Handoff — 2026-07-13

## Completed
- **El Coach abre el Diario (PLAY)** — merge `19a91e1c`, cierra backlog **PLAY #6**.
  El tile del Coach ya no abre el paywall: abre `/coach/history`, y **perdió el badge PRO**.
  La venta se mudó **detrás del valor** (el jugador ve sus partidas antes de que se le pida pagar).
- **Arreglo del red team (P0):** la rama **sin wallet** del diario ganó un **CTA de conectar real**.
  El paywall que sacamos era *también* el embudo de conexión (su CTA primario es "Connect wallet"),
  así que sin esto cambiábamos un muro por un **pozo**. El dead-end ya existía; el spec solo lo
  ponía en el camino de todos.
- **Se retiró `priceSubLabel`** ("≈ 6 cents a day") del ProSheet — ruido, y precio hardcodeado
  derivado a mano de $1.99/30 que habría mentido en silencio el día que PRO cambie de precio.
- **Las compras de PRO llevan `source`** (la superficie que vendió). Sin esto la decisión no era
  reversible con datos: contábamos entradas al diario, no compras atribuibles a él.
- Docs: spec + red team + plan + handoff
  (`docs/handoffs/2026-07-13-coach-opens-journal-handoff.md`).

## Current State
- **Branch**: `main` (rama `feat/coach-opens-journal` mergeada y borrada)
- **Build**: **5080 passing / 426 files** (venía de 5073), `tsc` limpio.
  Flujo **manejado en navegador real** en modo PLAY, no solo en tests.
- **Uncommitted work**: ninguno.
- **Push**: hecho por el founder. `main` == `origin/main` == `19a91e1c`.
- **Open PRs**: ninguno.

## Next Tasks
1. **Smoke del Hub Tour en MiniPay real** — es lo ÚNICO que separa a ese cluster de estar cerrado
   (ver `docs/handoffs/_next-session-prompt.md`). Cuatro cosas: ¿entra el "Got it"? ¿el flag
   `chesscito:hub-tour:v1` impide que reaparezca? ¿un dueño del pase ve el paso 2 **sin** precio?
   ¿late el CTA Join Challenge y deja de latir al comprar?
   **Reset a cuenta nueva:** `pnpm -C apps/web exec tsx scripts/reset-wallet.ts 0xWALLET --commit`
   (dry-run sin `--commit`; `--full` borra además escudos/Peones/scores/Coach) **+ `/dev/reset`**
   en el teléfono para el `localStorage`.
2. **Parte 2 del spec del Hub Tour** (no empezada): cierre del Daily (**Continue training**
   primario, **Join Challenge** secundario) + recordatorios del Challenge (CTA contextual + chip,
   **nunca modal**, máximo uno por día) + test que fije los **tres únicos llamadores** de
   `recordDailyCompletion`. Spec: `docs/specs/2026-07-12-hub-tour-daily-first-spec.md`.
3. **Cobertura VR del play hub** — **subió de prioridad**: descubrimos que esa superficie no tiene
   **ningún** snapshot, así que el cambio del dock viajó sin red visual.
4. **Mini-tour de PLAY** (PRO / Shop / Coach / Peones) — idea de esta sesión, **sin spec todavía**.
   La tesis: son las superficies con TX, las que le muestran a MiniPay que apoyamos su narrativa.
5. Replay del tour desde Settings (estado `replay` del spec) — no construido.
6. Pendiente desde 2026-06-07: revisión de telemetría de `enforceOrigin`.

## Blockers
- **Ninguno para código.** El smoke de MiniPay depende del device físico (founder).

## Notes
- **`/coach/history` NUNCA estuvo bloqueado por PRO.** Renderiza para cualquier wallet conectada y
  trae un `AskLuzBanner` escrito para `!isPro && credits === 0`. La página **ya estaba hecha para
  el free**; solo la escondía un `if` del hub. No construimos superficie: destapamos la que había.
- **Dos hallazgos míos murieron al verificarlos** — escritos como FALSOS en el red team para que
  nadie los re-descubra:
  1. *"El back del diario tira a TRAINING"* → **falso**. El modo es **build-time**; en el build de
     PLAY, `/` **es** el hub de PLAY (`hub-scaffold-client.tsx:15`). Lo leí de una captura en modo
     **FULL**, que es interno y no se envía. **Lección: verificar de qué build es la captura.**
  2. *"Hay que regenerar el baseline VR del dock"* → **no existe** baseline del play hub.
- **Desviación del spec §4:** la atribución de compras es por **superficie** (pathname congelado al
  abrir), **no** por CTA — el chip PRO y el tile del Coach viven los dos en `/`. `openSheet()` **no
  cambió de firma**, así que los ~15 call sites de arena/exercises/profile quedaron intactos.
- **Fallo preexistente, NO nuestro:** la VR `hub-shop-sheet-open` está roja **también en `main`**
  (verificado corriendo el test ahí). El tile de PRO de la Shop dice "Coming soon" sin la env del
  treasury — el "env contaminado" que el backlog ya registraba.
- **El pase de temporada vive en TRES lugares** (lo aprendimos armando el reset): Supabase
  `lite_season_passes` + Redis `lite:season-pass:<wallet>` (**fast path**: sin borrarlo el status
  sigue ACTIVE hasta 21 días) + `coach:shields:credited:<wallet>`. Y **PRO es un carril aparte**:
  si la wallet tiene PRO, el pase efectivo sigue activo. Todo con la wallet en **minúsculas**.
- **Sigue ABIERTA la incoherencia de la llama:** una sesión de 10 ejercicios no enciende el día.
- **`/api/sign-badge` firma cualquier `levelId` sin verificar estrellas** (`route.ts:23`) — el gate
  de 10★ es client-only. Es la deuda con consecuencia real antes de que haya dinero sobre un score.
