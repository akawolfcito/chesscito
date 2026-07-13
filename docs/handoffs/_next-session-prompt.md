# Next session prompt — post device pass, pre Hub Tour

Di **"continuemos"** y el agente debe leer este archivo y seguirlo.

---

**Estado al arrancar:** `main` = `2e0d97cf`. Suite **5026 passing / 423 test files**.
`tsc` limpio. **El device pass de LEARN cerró y está FIRMADO.**

**Leer primero:**
- `docs/handoffs/2026-07-12-learn-device-pass-and-hub-tour-spec-handoff.md` — la sesión.
- `docs/specs/2026-07-12-hub-tour-daily-first-spec.md` — **el spec del próximo cluster.
  Está completo. NO re-especificar.**

---

## ▶️ Ruta: construir el Hub Tour (Daily-first)

1. **Tour de 3 pasos** en el hub de LEARN (`/`): Daily → Challenge → Start Focus.
   Llave **`chesscito:hub-tour:v1`** (NO reusar `chesscito:onboarded`: la usa el splash).
   **Todo jugador lo ve una vez**, tenga la historia que tenga. Copy **dinámico**: a quien
   ya compró el pass no se le vende el pass.
2. **Cierre del Daily**: primario **Continue training**, secundario **Join Challenge**.
3. **Recordatorios del Challenge**: CTA contextual + chip. **Nunca modal.**

**La restricción que puede hundir el cluster:** el tour monta en el mismo hub que la cola
de celebración, el welcome gift y la SeasonPassSheet. **El tour es un GATE** — no arranca
si hay otro modal, y mientras corre nadie más monta uno. El test **debe contar
`[aria-modal="true"]`, NUNCA `role="dialog"`** (`LabyrinthCompleteOverlay` usa
`role="alert"`; contar roles pasa en verde con dos diálogos apilados).

**Reusar, no inventar:** `VictoryPopupShell` + `PrincipalButton` + iconos de
`public/art/**`. Lo único nuevo es el spotlight (scrim + anillo + flecha).

---

## Flujo de trabajo (CAMBIÓ el 2026-07-12)

**Merge local a `main` + UN push.** NO pushear ramas, NO abrir PRs con auto-merge —
disparaba un preview deploy + otro de prod por cada fix chico.

```
git -C <ruta> checkout -b <rama>      # trabajar, commits atómicos
git -C <ruta> checkout main
git -C <ruta> merge --no-ff <rama>
git -C <ruta> push origin main        # UNA vez
git -C <ruta> branch -d <rama>
```

El gate de calidad es **suite verde + `tsc` limpio ANTES del merge local**, no CI después.

## Higiene de comandos

- **Nunca prefijes con `cd`.** `git -C <ruta>` y `pnpm -C <ruta>`.
- Un comando por llamada. Sin pipes, sin heredocs.
- Typecheck: `pnpm exec tsc --noEmit` pelado.
- `env | grep NEXT_PUBLIC` debe salir vacío. `lsof -ti:3000` vacío antes de VR/E2E.

## Decisiones cerradas (NO re-litigar)

- **Solo LEARN y PLAY se envían. FULL es interno.** Si el único entry point de un feature
  vive en `HubScaffold` (FULL), **no existe para ningún jugador**.
- **Los ejercicios mandan el avance de pieza; los laberintos NO retienen el foco.**
- **El Daily ABRE la sesión.** El Lote 2.5 (Daily como cierre) está SUPERSEDED.
- **El tour no es onboarding**: todo jugador lo ve una vez. No se suprime por tener historia.
- **Nunca construir recovery para el Daily-Streak.**

## La lección de esta sesión

**Cuatro defectos reales con 5000+ tests en verde**, encontrados por un pase manual en
device. Cada componente era correcto **solo**; la composición era la mentira. El más caro
(#220) tenía tres eslabones y arreglar uno solo no lo mataba. **Un pase en device sobre un
perfil real sigue siendo el único que ve estas cosas.**

## Si el usuario dice…

- **"continuemos"** → leer el handoff + el spec, y arrancar por el tour.
- **"qué falta"** → `docs/backlog/2026-07-10-backlog-index.md`.
