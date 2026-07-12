# Device pass — máquina de hitos en MiniPay (perfil del founder)

**Fecha**: 2026-07-12 · **Estado**: pendiente de correr
**Build bajo prueba**: `main` ≥ `#214` (`9cfc24db`) · `learn-preview.chesscito.com` · Celo Mainnet
**Cuenta**: la del founder — **12★ de torre, badge de torre ya minteado**

> Por qué esta cuenta y no una limpia: esa forma exacta (progreso alto + badge on-chain)
> es la que expuso la carrera de seeding (`useAccount().status` contra una lectura de
> contrato deshabilitada). Una wallet limpia **no** reproduce el riesgo principal.

---

## Superficies — todo el pase es LEARN

El build de LEARN tiene **dos pantallas** en juego, y es fácil buscar en la equivocada:

- **HUB de LEARN = `/`** (la raíz, no `/hub`: esa es un alias legacy que redirige a `/`).
  Lo monta `hub-scaffold-client.tsx:15` cuando el modo no es `play` (`LearnHubClient`).
  En LEARN renderiza `HubLiteScaffold`: Mind Challenge, Focus Passport, Start Focus.
- **`/exercises`** — la escalera de estrellas, el laberinto, el badge, **Special Training**
  y todas las celebraciones.

PLAY/Arena queda **fuera** de este pase.

> **Special Training vive en `/exercises`, no en el hub.** Su puerta es el pedestal
> **TRAINING** del action row (`MiniArenaBridgeSlot`, `exercises-screen.tsx:2683`), abierto
> con 12★ de torre. La tile del hub (`HubArenaTile`) **solo monta en el scaffold FULL, que
> es interno** — en LEARN no existe. Buscarla ahí es buscar algo que ese build no tiene.
> Su punto rojo es un marcador propio ("desbloqueado, nunca ganado"), **distinto** del NEW
> de la máquina de hitos.

## Antes de empezar

- Saldo chico de un stable (sin CELO no hay gas — la app pasa `feeCurrency`).
- Anotar: modelo, versión de MiniPay, commit del deploy.
- **No borrar el storage.** El valor del pase está en el perfil viejo.
- Tener a mano una **pieza virgen** (caballo o alfil, sin estrellas): es el único
  camino para ver la escalera dispararse en vivo.

---

## Bloque A — Lo negativo (arranque en frío), el corazón del pase

Tu perfil ya pasó `first-reward`, `first-labyrinth:rook`, `special-training`,
`piece-badge-eligible:rook` y `piece-badge-claimed:rook`. El seeding debe marcarlos como
históricos y **no celebrar nada**. Cualquier ✅ acá es una regresión.

| # | Paso | Esperado |
| --- | --- | --- |
| A1 | Abrir la app en MiniPay, en frío, y esperar a que la wallet conecte | **Cero overlays.** Ni regalo, ni laberinto, ni Special Training, ni badge |
| A2 | En **`/exercises`** con la **torre** seleccionada, mirar el pedestal **TRAINING** del action row | Está **presente y abierto** (tenés 12★ de torre). Su punto rojo es el marcador "nunca lo ganaste", no el NEW de la máquina de hitos. **No buscar tile de Special Training en el hub: en LEARN no existe** (vive en el scaffold FULL, que es interno) |
| A2b | Tocar el pedestal TRAINING | Abre la MiniArenaSheet (K+R vs K) |
| A3 | Matar la app y reabrirla 2–3 veces seguidas | Ninguna celebración aparece en ningún reintento |
| A4 | Abrir la app **con la wallet aún desconectando** y quedarse en el HUB | No se estampa la corona de Mastery ni un `piece-badge-claimed` falso. Ese es el race |
| A5 | Grid de trofeos | El badge de torre figura como poseído; ningún trofeo nuevo aparece "recién ganado" |

---

## Bloque B — La escalera en vivo (pieza virgen: caballo o alfil)

| # | Paso | Esperado |
| --- | --- | --- |
| B1 | Resolver ejercicios de la pieza virgen hasta **6★ + 3 ejercicios** | Overlay de **desbloqueo del laberinto**, con punto NEW en el drawer |
| B2 | Abrir el laberinto desde ese overlay | El NEW se apaga al abrir (no antes) |
| B3 | Seguir hasta **10★ de esa pieza** | Overlay de **badge disponible** — y **UN SOLO** diálogo en pantalla, no dos apilados |
| B4 | Reclamar el badge y esperar el receipt | Háptica, celebración, badge en Owned. Nada celebra sobre el hash |
| B5 | **Cancelar** un claim (rechazar en la wallet) | Vuelve a idle, sin celebración, **y el reconocimiento sobrevive**: el overlay de "badge disponible" sigue reclamable |

> El regalo (`first-reward`) **no se puede ver en tu cuenta**: es global y ya lo pasaste.
> Sólo aparece en wallet/storage limpios, y sólo en build **Lite** (`giftAvailable`).

---

## Bloque C — Lo diario (sí se puede probar en tu cuenta; resetea a UTC midnight)

| # | Paso | Esperado |
| --- | --- | --- |
| C1 | Ganar **8★ netas hoy** (mejoras reales; repetir un ejercicio ya perfecto no suma) | Overlay **Great Focus Session** |
| C2 | Alternativa: agotar la cuota de sesión (10) sin llegar a 8★ | Igual celebra — y **la celebración va antes del límite de sesión**, nunca al revés |
| C3 | Agotar la cuota estando ya celebrado | El paywall/límite recién aparece después de drenar la cola |
| C4 | Si te toca `first-great-session` | Aparece **una vez**, y comparte icono con `first-focus-day` (aceptado, no es bug) |

---

## Bloque D — Cola y persistencia

| # | Paso | Esperado |
| --- | --- | --- |
| D1 | Provocar dos hitos juntos (ej. llegar a 10★ y a 8★ diarias en el mismo solve) | **Un modal por vez**, en orden. Nunca dos `aria-modal` a la vez |
| D2 | Cerrar la app **con un overlay abierto** y reabrir | El hito ya quedó persistido: no se re-celebra, y tampoco se pierde el acceso |
| D3 | Cerrar la app durante `confirming` de un claim y reabrir | El badge se auto-cura leyendo la cadena. Sin celebración fantasma |
| D4 | Cambiar a una **cadena no soportada** y volver | Sin celebraciones mientras estás en la cadena mala; al volver, nada se perdió |

---

## Cómo reportar

Por fila: ✅ / 🔴 + screenshot si es 🔴. Un 🔴 en el **Bloque A** es bloqueante y frena el
pase: significa que la máquina le está mintiendo a un jugador con historia. Un 🔴 en B/C/D
se anota y se evalúa contra el criterio de siempre: **¿impide completar el flujo o corrompe
progreso, pagos o estado?** Si no, se difiere.

## Riesgos ya conocidos (no los reportes como nuevos)

- `first-focus-day` y `first-great-session` comparten icono. Aceptado.
- En `timeout` el CTA sigue ofreciendo *Try Again* aunque la tx ya se firmó. No tocar sin medir.
- `first-great-session` y `piece-badge-claimed` pueden quedar "pending" para siempre en el
  store. Benigno hoy: el grid lee presencia, no `celebratedAt`.
