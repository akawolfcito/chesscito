# Playtest del duelo p2p — cómo probarlo de punta a punta

**Fecha:** 2026-08-15 · **Para:** el primer duelo real entre dos dispositivos
**Qué se está probando:** `docs/handoffs/2026-08-15-p2p-duel-stage-5-handoff.md`

> **Por qué existe esta guía.** La suite (680 archivos, 8399 tests) y el VR (67/67) están verdes,
> y aun así el duelo **no está verificado**: nadie lo abrió. Lo que sigue no lo puede hacer un
> test. Pero hay dos cosas del entorno que lo van a romper de formas que **parecen bugs del
> feature y no lo son**, así que van primero.

---

## 0. ⛔ DOS BLOQUEADORES DE ENTORNO — arreglar ANTES de abrir nada

### A. El origen: hoy crear un duelo devuelve **403**

`apps/web/.env.local` tiene `NEXT_PUBLIC_APP_URL` y `NEXT_PUBLIC_PREVIEW_URL` apuntando a un
**túnel viejo** (`britannica-governor-meet-brooklyn.trycloudflare.com`).

`enforceOrigin` compara el `Origin` del request contra esa lista y **no exime a localhost**. O sea:

| desde dónde abrís | qué pasa hoy |
| --- | --- |
| `localhost:3002` | ⛔ **403 `origin_blocked`** |
| un túnel nuevo | ⛔ **403 `origin_blocked`** |
| el túnel viejo (ya no existe) | ✅ (inalcanzable) |

**En pantalla verías *"Something went wrong. Try again."*** al tocar `Create and share`, y parece
que el duelo está roto. No lo está.

**Arreglo:** poné en `apps/web/.env.local` los hosts que vas a usar de verdad. Se leen los dos
valores, así que podés cubrir túnel y local a la vez:

```
NEXT_PUBLIC_APP_URL=https://<tu-tunel-nuevo>.trycloudflare.com
NEXT_PUBLIC_PREVIEW_URL=http://localhost:3002
```

⚠️ **Y hay que reiniciar `pnpm dev`**: son `NEXT_PUBLIC_*`, se hornean en el bundle.

### B. El shell tiene `NEXT_PUBLIC_CHAIN_ID=11142220` exportado

Es Celo Sepolia, y **en Next el shell le gana a `.env*`**. No rompe el duelo (es off-chain), pero
`ChainConfigWarning` va a pintar un banner ámbar de dev encima de la pantalla y te va a tapar la
parte de arriba de cada captura que saques.

**Arreglo:** abrí la terminal donde vas a correr `pnpm dev` y hacé `unset NEXT_PUBLIC_CHAIN_ID`.

---

## 1. Lo que NO hace falta

✅ **No hacen falta dos cuentas.** La autoridad sobre un asiento sale de una **credencial del
servidor**, no de la wallet ni de la sesión. Podés entrar con **la misma cuenta** en los dos
dispositivos y el duelo funciona igual. (El pozo del allowlist de Privy son 5 a 7 cuentas, así que
esto te ahorra quemar una.)

⛔ **Lo que SÍ hace falta son dos CONTEXTOS de navegador separados.** El token vive en
`localStorage`, por duelo. Si abrís el enlace en la misma pestaña o en el mismo perfil, el
servidor te reconoce como el creador y responde `alreadySeated` — **no vas a ver el botón JOIN**, y
va a parecer que el JOIN está roto.

Sirven: dos teléfonos · teléfono + desktop · un navegador normal + uno en incógnito.

---

## 2. El recorrido, paso a paso

### Dispositivo 1 — crear

1. `/arena` → el selector de rival.
2. ⬜ **La cuarta tarjeta "A friend"** está ahí, debajo de Hard, y **no se ve como una cuarta
   dificultad**. (No lleva check de seleccionada: es una acción, no un toggle.)
3. Tocala → se abre la escalera del reloj.
4. ⬜ Abre en **10 min**. Tocá `−` y `+`: los valores son **30 sec · 1 · 3 · 5 · 10 · 15 · 30**, y
   **frena en las dos puntas** en vez de dar la vuelta.
5. Tocá **Create and share**.
6. ⬜ Llegás a "Waiting for your friend" con el botón de compartir.

### El enlace — la revisión más importante

7. ⛔ **Copiá el enlace y miralo antes de mandarlo.** Tiene que ser
   `https://<host>/<locale>/arena?duel=<id>` y **NADA más**.
   - **Si contiene `privy_oauth_code` o `privy_oauth_state`, pará y avisame**: eso sería mandarle
     a tu amigo el código OAuth de tu propio login. Es el defecto contra el que se escribió
     `link.ts` y hay tests, pero esto lo confirma en el mundo real.
8. ⬜ Si probás desde el túnel, el enlace debe conservar el **host del túnel** (no
   `play.chesscito.com`). Eso es a propósito: si reescribiera, cada prueba te mandaría a
   **producción**.

### Dispositivo 2 — entrar

9. Abrí el enlace en el otro contexto.
10. ⬜ Se ve el tablero, **quién te invitó**, y un botón **Join the game**.
11. Tocalo → ⬜ los **dos relojes arrancan** y el tablero se desbloquea del lado de las blancas.

### Jugar

12. ⬜ **Sólo el que tiene el turno puede mover.** Tocá una pieza en el dispositivo que NO tiene el
    turno: no debería pasar nada.
13. ⬜ **El tablero se ve desde tu lado.** Si te tocaron negras, las negras están abajo.
14. ⬜ **Una jugada aparece en el otro dispositivo en ~3 segundos** (sin recargar).
15. ⬜ **Los relojes se mueven fluido**, no a saltos de 3 segundos.

### Los dos casos que más me interesan

16. ⬜ **Promoción de peón.** Llevá un peón a la última fila. Tiene que abrirse el selector de
    pieza. Probá **cancelar**: no debería mandar ninguna jugada ni dejar el tablero raro.
17. ⛔ **Que se acabe el tiempo.** Creá un duelo de **30 segundos** y dejá correr el reloj de uno
    de los dos sin mover.
    - ⬜ El número llega a 0 **y se queda en 0**.
    - ⬜ La partida termina con *"You ran out of time"* / *"Your rival ran out of time. You win."*
    - ⛔ **Esto es lo más frágil de todo el feature**: la derrota la tiene que declarar el
      SERVIDOR, no el reloj de tu pantalla. Si ves un resultado que aparece instantáneo apenas
      llega a 0 y el otro dispositivo dice otra cosa, es exactamente el bug que hay que cazar.

### Y los bordes, si te queda ganas

18. ⬜ **Abrí tu propio enlace** en el dispositivo 1: retomás tu asiento, **no** ves JOIN y **no**
    ocupás el segundo asiento.
19. ⬜ **Un tercer contexto** abre el enlace con la partida ya empezada: ve el tablero, **sin** JOIN
    y **sin** rendirse. Es sólo lectura, y es a propósito.
20. ⬜ **Rendirse**: pide confirmación, y el otro dispositivo ve la victoria.
21. ⬜ **Modo avión** a mitad de una jugada: ⚠️ debe decir "No connection" y **volver a leer el
    tablero**, nunca reenviar la jugada.

---

## 3. Lo que ya sé que está mal y NO hace falta que reportes

- ⚠️ **Un tablero bloqueado no tiene señal para lectores de pantalla** — 64 botones habilitados en
  un tablero que no se puede jugar. Es preexistente, lo tiene también la arena contra la IA, y
  queda como su propio cambio.
- ⚠️ **Las piezas no se deslizan al moverse**, aparecen en su casilla nueva. Es una decisión del
  v1, no un bug.
- ⚠️ **`invitedBy` está vacío en todos los duelos.** No hay identidad verificable server-side.

---

## 4. Si algo falla, qué mirar antes de avisarme

| síntoma | causa más probable |
| --- | --- |
| *"Something went wrong"* al crear | El **§0.A**: origen. Revisá `NEXT_PUBLIC_APP_URL`. |
| No aparece **JOIN** en el segundo dispositivo | Mismo contexto de navegador. Usá incógnito. |
| Banner ámbar arriba | El **§0.B**: `NEXT_PUBLIC_CHAIN_ID` en el shell. |
| *"This duel does not exist"* | El enlace se cortó al copiarlo, o pasó **1 hora**. |
| Todo carga pero nada se mueve | Mirá la consola: si hay 429, es el rate limit (Redis). |
