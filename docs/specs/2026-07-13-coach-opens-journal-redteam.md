# Red team — spec "Coach abre el Diario" (2026-07-13)

Revisión adversarial de `2026-07-13-coach-opens-journal-spec.md` **contra el código**, no
contra el texto del spec. Dos de los tres hallazgos son defectos que el spec **afirma como
resueltos**.

---

## P0 — El usuario sin wallet pierde el camino para conectar

**El spec miente en su propia tabla de estados.** Dice:

| Free, sin wallet | `connectWalletForHistory` (ya existe) | **Salida: Conectar** |

Esa salida **no existe**. La rama sin wallet de `/coach/history` renderiza *un párrafo y nada
más*:

```tsx
// coach/history/page.tsx:59-66
if (!address) {
  return (
    <main className="tj-root">
      <PageHeader onBack={() => router.push("/")} />
      <p className="tj-no-wallet-text">{t("connectWalletForHistory")}</p>
    </main>
  );
}
```

`connectWalletForHistory` = *"Connect your wallet to view your Coach history."*
(`editorial.ts:1610`). Es una **frase**, no un botón. No hay CTA de conectar en esa pantalla.

**Lo que estamos rompiendo.** Hoy, un usuario **sin conectar** que toca Coach recibe el
ProSheet — y el CTA primario del ProSheet es literalmente **"Connect wallet"**. O sea: el
paywall que queremos sacar **también es el embudo de conexión**. Después del cambio, ese
mismo usuario cae en una oración y su única salida es el back del header.

**Cambiamos un paywall por un callejón sin salida.** Y no es un caso de borde: en la captura
que motivó este spec, el header dice **"Connect"** — el usuario está desconectado. Ese es el
estado por defecto de un jugador nuevo en web.

*Atenuante, no absolución:* en MiniPay la wallet se auto-conecta, así que en el canal que nos
importa para la listing esto casi no pega. Pero PLAY también se sirve en web.

**Arreglo (elegir uno, va en el spec antes de implementar):**
- **(a)** La rama sin wallet del diario gana un CTA de conectar de verdad. Es el arreglo
  correcto: la pantalla hoy es un dead-end para *cualquiera* que llegue sin wallet, no solo
  desde el dock. Arregla un defecto que ya existe.
- **(b)** El dock rutea a `/coach/history` solo si hay wallet; sin wallet, sigue abriendo el
  ProSheet (que conecta). Más barato, pero conserva "vender antes de mostrar" justo para el
  usuario más nuevo — o sea, contradice la tesis del spec.

**Recomendado: (a).**

---

## P1 — ~~El back del Diario tira al hub equivocado~~ → RETIRADO (falso)

**Este hallazgo era mío y era incorrecto. Lo dejo escrito para que nadie lo re-descubra.**

La sospecha: `page.tsx:62` y `:93` hardcodean `router.push("/")` en vez de `router.back()`,
así que un jugador que entra desde PLAY volvería al hub raíz en la pestaña TRAINING.

**Por qué es falso:** el modo es **build-time**, no una pestaña
(`CHESSCITO_MODE = full | learn | play`). En el build que **enviamos** como PLAY, `/` renderiza
`PlayHubClient` directamente:

```tsx
// hub-scaffold-client.tsx:15
return CHESSCITO_MODE === "play" ? <PlayHubClient {...props} /> : <LearnHubClient {...props} />;
```

`router.push("/")` **devuelve al hub de PLAY**. El toggle TRAINING|PLAY solo existe en **FULL**,
que es **interno y no se envía** ([[project_shipped_modes_learn_play]]).

**Impacto real:** una molestia solo en el build interno. **No se construye nada.**

*La lección: el defecto se vio en una captura de FULL. Antes de escribir un hallazgo desde una
captura, verificar en qué build fue tomada.*

---

## P2 — La métrica que el spec promete no mide lo que dice

El spec afirma que `pro_active` en `play_hub_coach_tap` es *"la métrica que valida o mata esta
decisión"*. **No lo es.** Mide **entradas** al diario, no **conversiones atribuibles al
diario**. No hay ningún evento que ate una compra de PRO al camino del diario.

Consecuencia concreta: si el funnel de PRO baja después de este cambio, **no vamos a poder
distinguir** si el diario es la causa (sacamos el paywall del dock y nadie compra) o la cura
(la gente compra más tarde y mejor). Nos quedamos sin poder revertir con evidencia — y la
*open question* del spec dice explícitamente que esto es "reversible si el funnel se desploma".
No lo es, si no podemos verlo.

**Arreglo:** el ProSheet necesita una dimensión de **origen** (`source: "coach_dock" |
"journal" | "pro_chip" | ...`) al abrirse y al concretar la compra. Es barato y es lo que hace
falsable la tesis del spec.

---

## No-hallazgos (verificados, para que nadie los vuelva a levantar)

- **El CSS del badge NO queda muerto.** `.play-hub-action-badge` la reusa
  `play-tactics-tile.tsx:67` para el badge "done". Sacarla del Coach no deja regla huérfana en
  `globals.css:8646`.
- **Ningún test asserta `priceSubLabel`.** Borrarla no pone nada en rojo. (El reverso: nada la
  estaba protegiendo — coherente con el argumento de que era precio hardcodeado.)
- **El empty state del diario existe de verdad** (`coach-history.tsx:277-290`): icono, título,
  cuerpo y CTA a `/arena?fresh=1`. Ese estado del spec sí es correcto.

---

## Veredicto

La **tesis** del spec (mostrar antes de vender) sobrevive intacta, y **P1 se cayó al
verificarlo contra el build correcto**. Lo que no sobrevive es la afirmación de que "no
agregamos superficie, solo destapamos": hay que **construir el CTA de conectar** (P0), o el
cambio reemplaza un muro por un pozo.

- **P0 — se arregla.** No porque el canal principal lo sufra (MiniPay auto-conecta, y el social
  login lo disolvería del todo cuando llegue), sino porque son ~10 líneas reusando
  `useConnectWallet` + `PrincipalButton` —que el diario **ya importa**— y porque el dead-end
  **ya existe hoy** para cualquiera que llegue sin wallet. Sale más barato arreglarlo que
  documentar por qué no lo arreglamos.
- **P1 — no se construye nada.** Era falso.
- **P2 — se arregla.** Es lo único que hace *falsable* la tesis del spec.
