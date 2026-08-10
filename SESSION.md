# Session Handoff — 2026-08-09

## Completed

**Cluster A — el contador que se pasaba de su meta** (`831053b`, `1a84cf3`)
- El chip de `/exercises` mostraba `9/8` (alfil) y `10/8` (el resto): el denominador es el
  GATE de la insignia (80% del pool = 8) y el numerador contaba el pool entero.
- Topeado en `8/8`, con un `+` para quien se pasó → `8/8+`. ⛔ Un `+` y NO una estrella:
  el ★ del HUD es la métrica de recompensa y este gate se sacó a propósito de las estrellas.
- La aserción del VR (`/^\d+\/\d+$/`) daba verde con `9/8`. Ahora compara los dos lados.
- ✅ Verificado en device por el founder.

**Cluster B — el guardado que emboscaba** (`77202ac`, `5f9deba`, `22c3600`, `0b6fc61`)
- Dos caminos disparaban un guardado SOLO al montar `/exercises` y llegaban a `signMessage`
  sin gesto del jugador. Lectura del founder: *"se siente una app insegura que trata de
  sacarte los fondos"* — que es la forma exacta de un phishing.
- Violaba una invariante ESCRITA en `session-client.ts:44` (*"NUNCA pide firma al montar"*).
- El candado quedó en `ensureScoreSession` —la única función que puede abrir la wallet—
  como campo **requerido**: un camino nuevo no compila sin decidir.
- ⛔ **El banner de guardado se eliminó** (−310 líneas): pedir el reintento costaba una
  firma, no pedir nada costaba cero.
- ✅ Verificado en device por el founder.

**Auditoría de fixtures VR atados al reloj** — cerrada, ninguno suelto.
**Cluster Closure Protocol** — completo: 0 issues, README sin cambios, memoria sincronizada,
branch `production-backup-2026-08-05` borrada (tag local `archive/production-backup-2026-08-05`
→ `da1cc992`), handoffs escritos.

## Current State
- **Branch**: `main` (local, **64 commits SIN PUSHEAR** a `origin/main`)
- **Build**: passing — 7582 tests / 617 files, EXIT=0, cero `Unhandled Errors`; `tsc` limpio;
  `content:audit` en 147 hallazgos (los mismos de antes, sin regresión)
- **VR**: 67 passed con `--project=minipay --update-snapshots=none`, cero PNG nuevos
- **Uncommitted work**: no — árbol limpio
- **PRs abiertos**: ninguno

## Next Tasks
1. **PUSH a `origin/main`** — 64 commits. Es del founder, no mío.
2. Libre para tareas nuevas. Nada bloqueado.
3. (Opcional, sin prioridad) La línea de la cola en **Account** + tick pasivo "Saved" en el
   `PhaseFlash` — destino acordado si alguna vez hay que hablar de la cola. **NO** volver a
   poner un banner en el tablero.
4. (Opcional) Source guard que impida que un fixture VR nuevo monte un lector de reloj.

## Blockers
- Ninguno.

## Notes
- ⛔ **`retry()` del outbox quedó sin consumidores** en el producto. Se mantuvo a propósito:
  es lo que usaría la línea de Account. Si esa superficie no se construye, es código muerto
  y hay que decidirlo explícitamente.
- ⚠️ **El VR necesitó dos corridas**: 4 casos de `/dev` fallaron por `page.goto` timeout de
  45 s (compilación en frío del dev server), NO por píxeles. Re-corridos solos, verdes.
  **No confundir ese modo de falla con una regresión visual** — el log dice `TimeoutError`.
- ⛔ **Paso 3 del brief de visibilidad (promover el mapa) está DESCARTADO** por decisión del
  founder tras jugarlo. No reaparece como pendiente.
- ⛔ **La "validación del Paso 2" se cerró sin ejecutarse**: exigía un jugador ingenuo que
  volviera a los 3 días, y ese sujeto no existe (434 de 443 jugaron un solo día).
- 📌 El aprendizaje que sobrevive a la sesión: **el candado va en quien OTORGA la capacidad,
  como campo requerido** — dos versiones del spec taparon llamadores y siempre quedó otra
  puerta. Al implementarlo, `tsc` señaló 4 call sites, 2 de ellos fuera de todo análisis.
- Índice de memoria compactado de 19,6 KB → 16,2 KB (llegaba al límite de lectura).
