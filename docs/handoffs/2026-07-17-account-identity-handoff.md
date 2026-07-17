# Handoff — Account: MiniPay-aware + la identidad del jugador (2026-07-17)

**Estado:** `main` = `af3cc503` · 5352 passing / 454 files · typecheck limpio.
Verificado por el founder en el juego real. Cuatro commits, fast-forward, sin PR.

---

## Qué cerró

### 1. La Account sheet aprende dónde vive (`4f28b29a`)

MiniPay inyecta **una y solo una** address, sin forma de cambiarla desde la miniapp. Copiar
la address y desconectarse eran controles muertos ahí: ofrecen una salida que el entorno no
tiene. Dentro de MiniPay el tile de Wallet queda estático y Disconnect no se renderiza. En un
browser con MetaMask/Rabby todo sigue igual — ahí la wallet **sí** es intercambiable.

**La decisión gatea sobre `isReady`, no sobre `isMiniPay` solo.** `useMiniPay` reporta
`isMiniPay: false` hasta que corre su efecto; decidir con ese valor pre-hidratación haría
parpadear ambos controles dentro de MiniPay. Hay un test que fija exactamente eso — es la
misma trampa de [[feedback_never_decide_from_unhydrated_state]].

### 2. El chip Chesscito ID (`bcee288e`)

La sheet mostraba wallet y red: dos datos que nadie usa para reconocerse. El nick del
leaderboard no estaba en ninguna parte, así que el jugador no tenía cómo saber cuál de esas
filas era la suya. El chip vive arriba de la Chesscito Card y reusa `PlayerAvatar` — el mismo
disco+pieza que renderiza el leaderboard, así el chip y la fila no pueden divergir.

**⚠️ El chip muestra el nick GENERADO, no el display name resuelto.** Ver §Invariantes.

### 3. Tu fila del leaderboard usa el crema del chip (`af3cc503`)

El row pineado de YOUR RANK vestía `--top2`: un color de **rango plata** que no le
corresponde. Ese row no es el puesto 2, es el JUGADOR, tenga el puesto que tenga. Ahora usa
el mismo shell crema que el chip, referenciando **las mismas variables**
(`--cta-secondary-cream-*`) — no hay dos definiciones que puedan derivar. El jugador se
encuentra con UNA sola cara de "este sos vos" en las dos pantallas donde se lo pregunta.

### 4. Backlog §5.1 (`68390ddc`)

El razonamiento del lápiz diferido, escrito donde se va a leer cuando alguien lo pida de nuevo.

---

## Invariantes que dejó (no romper)

**El nombre custom nunca sale del `localStorage`.** `useDisplayName().name` resuelve
custom > generado, pero el custom **no viaja al servidor** (la ruta de guardado de scores no
lo lleva). El leaderboard le muestra al resto siempre el generado —
`leaderboard-sheet.tsx:148-154` solo pisa tu propia fila, en tu propio device.

Consecuencia: **un chip con el nombre custom te nombraría algo que nadie más puede ver** —
lo contrario de para lo que existe. Por eso el chip deriva con `formatNickname(variant,
tokens)` en vez de usar `useDisplayName`. Hay un test que mete "Wolfcito" en `localStorage`
y exige que el chip lo ignore. **Si alguien "simplifica" eso a `useDisplayName`, el test cae
y esa es la intención.**

Y por eso el chip **no lleva lápiz**: el esfuerzo no es la razón —`DisplayNameDialog` + el
lápiz de `ProfileBanner` ya existen y están cableados en `ProfileSheet`, con tests. Editar un
"Chesscito ID" que ningún otro jugador ve sería una promesa falsa.

---

## Próxima sesión

**Acordado con el founder:** seguir con **el `dev/builder` pendiente** + otros detalles por
pulir. Contexto obligatorio antes de tocarlo:
[[project_builder_only_knows_two_kinds]] — el builder LISTA los juegos firma pero guardarlos
les BORRA su kind.

Abierto y sin decidir (ninguno bloquea):

- **La fila tuya DENTRO de la lista sigue azul** (`--own`), mientras la pineada es crema.
  Dos colores para la misma persona. Lectura defendible tal como está (el azul localiza
  dentro de la lista, el crema es tu tarjeta) o unificar a crema: es un one-liner. El founder
  lo vio así y lo aprobó — no es deuda, es una decisión no tomada.
- **El editor de nombre es superficie casi muerta.** `ProfileSheet` solo abre por el
  deep-link `?sheet=profile`, apagado en LEARN (`learn-hub-client.tsx:180`). O vuelve (con el
  nombre viajando al server + moderación: `validateNickname` ya tiene blocklist y **nadie lo
  llama**) o se retira. Backlog §5.1.

---

## Notas de proceso

- **No hay baseline VR de ninguna de las dos superficies.** La Account sheet necesita wallet
  conectada; la Leaders sheet no está en `visual-regression.spec.ts`. Nada que regenerar —
  pero también significa que **ningún test protege estos píxeles**.
- El founder verificó en device. No hice polling del deploy
  ([[feedback_deploy_verification_is_the_founders]]).
