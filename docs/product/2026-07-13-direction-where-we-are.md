# Dónde estamos, hacia dónde vamos y cómo avanzamos — 2026-07-13

**Status**: directriz vigente
**Reemplaza**: *"Dónde estamos y por qué"* (mismo archivo, versión anterior del 2026-07-13). La v1
quedó **demasiado binaria** — declaraba el duelo "congelado" y el listado de MiniPay "lo único con
reloj". **Ninguna de las dos cosas representa la intención del founder.** Ver §"Qué afirmaba la
versión anterior y no estaba respaldado".

**Escrito porque**: después de tres iteraciones del spec del duelo, el founder dijo *"no sé en qué
punto estamos, me siento perdido y no siento que tengamos una directriz"*. Este doc existe para que
esa sensación no se reconstruya de memoria, y para que **ninguna sesión futura convierta una visión
progresiva en una feature completa de una sola vez**.

---

## 1. La respuesta corta

**Chesscito avanza por capas. Cada iniciativa tiene una capa actual, una próxima capa mínima, y un
gate que hay que cruzar para pasar a la siguiente.** Nada se construye "completo" por adelantado.

- **El frente principal hoy es pulir lo que ya se ve**: ejercicios, primera sesión, contenido visible.
- **En paralelo y barato**: darle utilidad real a los Peones, y encender un theme PRO visible.
- **Investigación de arquitectura**: identidad progresiva / social login (afecta todo lo demás).
- **El duelo NO está congelado**: se construye por capas, empezando por la más chica (abrir un enlace
  y jugar, **sin wallet**). Lo que espera a MiniPay es **el deep link nativo**, no el duelo.
- **MiniPay es una dependencia externa en observación**, no un bloqueo del roadmap.

> **Construir la capa mínima que demuestre valor, medirla, y dejar que el resultado desbloquee la
> siguiente.**

---

## 2. Estado actual real

| Frente | Capa actual | Próxima capa mínima | Gate para avanzar | Techo futuro |
| --- | --- | --- | --- | --- |
| **Aprendizaje** | Ejercicios y laberintos funcionales | Pulir primera sesión y ocultar contenido débil | Comprensión y finalización aceptables | Juegos combinados |
| **Peones** | Se ganan, pocos sinks | 2–3 usos claros | Gasto real y utilidad percibida | Economía social |
| **Themes** | Foundation dormida | Theme PRO visible | Uso y percepción de valor | Marketplace |
| **Identidad** | Wallet-first parcial | Social login progresivo | Guardado y recuperación confiables | Identidad portable |
| **Duelo** | Spec y riesgos conocidos | Abrir enlace y jugar | Uso real del duelo | Viewer, fans y regalos |
| **MiniPay** | En revisión | Ejecutar la probe al aprobarse | Deep link validado | Canal de distribución |

**Esta tabla es el índice del documento.** Cuando aparezca una idea nueva, ubicarla acá **antes** de
diseñarla.

---

## 3. Qué ya existe (verificable en el código)

Nada de esto hay que reconstruirlo ni redescubrirlo.

**Aprendizaje**
- Ejercicios por pieza — las **seis** son jugables (`PLAYABLE_PIECES`, `lib/game/exercises.ts:9`).
- Progreso por piezas, estrellas, badges, laberintos.
- Rotación de ejercicios: 4 decisiones cerradas (`project_exercise_rotation`).

**Themes — foundation SHIPPED y DORMIDA** (2026-05-26, `apps/web/src/lib/themes/`)
- `theme-registry.ts` — record `THEMES`, union `ThemeAssetKey` (**type-safe**: falta un asset → error
  de compilación), `ThemeAssetEntry = { default; pro? }`.
- `use-active-theme.ts` — hoy devuelve `DEFAULT_THEME_ID` (`candy-forest`) **hardcodeado**.
- `use-theme-asset.ts` — fallback elegante: sin variante `pro` → cae a `default`.
- `use-owned-themes.ts` — hoy devuelve `[DEFAULT_THEME_ID]`.
- Superficie canónica ya migrada: `kingdom-anchor.tsx`.
- **Todo cableado y apagado.** Spec: `docs/superpowers/specs/2026-05-26-theme-system-foundation.md`.

**Duelo — spec y red-team completos, sin código de producto**
- `docs/specs/2026-07-13-async-link-duel-spec.md` (v3).
- `docs/specs/2026-07-13-async-link-duel-redteam.md` (v3, con trazabilidad v1→v2→v3).
- `apps/web/src/app/dev/duel-link-probe/page.tsx` — **probe de device, construida y verificada**
  (`tsc` limpio, renderiza sin errores). Responde: ¿hay wallet acá? ¿sobrevivió el `?challenge=`?
  ¿cuánto tarda un `personal_sign`? ¿vive la cookie? **Habla con `window.ethereum` directo, sin
  wagmi**, a propósito: tiene que renderizar en webviews sin provider.
- **Reusable del duelo, aplicable a D1**: `lib/coach/validate-game.ts` es un árbitro server-side real
  (replica SAN con chess.js, detecta mate/ahogado/tablas). `components/arena/arena-board.tsx` es
  **100% presentacional**. Redis con TTL + Lua/CAS ya está cableado en `api/games/route.ts`.
- **Verificado**: chess.js **1.4.0** expone `isStalemate`, `isInsufficientMaterial`,
  `isThreefoldRepetition` e `isDrawByFiftyMoves` **por separado**.

**Economía (números leídos del código, 2026-07-13)**
- `PEONES_DAILY_CAP = 6` (`lib/peones/types.ts:96`).
- `SHIELD_RESCUE_PEONES_COST = 2` (`lib/peones/shield-spend-fallback.ts:33`).
- `PEONES_WELCOME_PACK_AMOUNT = 1` (`lib/peones/welcome-pack-server.ts:46`).
- `peonesReward: 50` (`lib/payments/rail-config.ts:115`) — recompensa de **compra**, no de juego.
- ⚠️ **El inventario completo de fuentes y sinks NO está hecho.** Es la primera tarea del Frente 2.

**Deuda de seguridad conocida**
- **`/api/games` acepta la wallet del body sin firma** (`api/games/route.ts:21`; el único chequeo es
  `isAddress()` — valida el **formato, no la propiedad**). Hoy sólo permite vandalizar el archivo de
  otro. **Descubrimiento del trabajo del duelo, pero independiente de él.** Cualquier feature que use
  la wallet como **autorización** (no como etiqueta) tiene que resolver esto primero.

---

## 4. Qué aprendimos y qué no debemos repetir

**El duelo se especificó tres veces. No fue tiempo perdido: cada versión murió por un defecto real
que la anterior escondía.** Esa trazabilidad se conserva porque **el próximo intento arranca desde
acá, no desde cero**:

| Versión | Modelo | Qué la mató |
| --- | --- | --- |
| **v1** | Asiento anónimo con seat token en cookie | La cookie **muere en el webview de WhatsApp**, que es *el* camino del producto. |
| **v2** | Arena única, **wallet = asiento** | La wallet **no estaba autenticada**: `api/games/route.ts:21` la toma del body y sólo valida `isAddress()`. Cualquiera podía mover, aceptar y rendirse **en nombre de otro**. |
| **v3** | + **sesión firmada** (nonce + `personal_sign`) | Nada de diseño. La frenó **la plataforma**: el enlace viaja por WhatsApp, y **ese webview no tiene wallet**. Y no existe deeplink documentado a una dApp con parámetros — nuestro propio research lo dice (`docs/product/2026-06-24-minipay-celo-primitives-research.md:75-80`: el **único** deeplink documentado es el de depósito, `https://minipay.opera.com/add_cash`). |

**Las lecciones, en orden de importancia:**

1. **El error de proceso fue de ORDEN, no de esfuerzo.** La primera pregunta debió ser *"¿dónde
   aterriza el jugador invitado?"*. Se hizo después de tres specs. **En una feature cuyo corazón es un
   enlace, el camino del enlace se mide ANTES de diseñar el asiento.**
2. **La v3 asumió wallet = asiento y por eso se pintó contra la pared.** D1 (abajo) **revierte
   explícitamente ese supuesto**: se juega **sin wallet**. La wallet aparece **después**, como valor
   agregado.
3. **Se ranquearon iniciativas por su capa actual en vez de por su techo.** El theme builder se
   despachó como "tooling interno" (era: marketplace de creadores). El duelo se ranqueó como "growth
   puro" (era: economía de espectadores). **Cuando una iniciativa parezca menor, preguntar por su
   techo antes de descartarla.**
4. **"Builder" significó tres cosas distintas en una sola sesión.** Ver §8.
5. **Cuando un cálculo nuestro contradice una medición de device, el equivocado suele ser el
   cálculo** (`feedback_suspect_your_derivation_first`).
6. **Un VR verde puede ser la foto de un error de Next** (`feedback_vr_green_can_photograph_an_error`).
   Lo que un probe `/dev` fotografía **recibe su verdad por props**, nunca de un hook de wallet.

---

## 5. Principio rector de producto

> **Construir la capa mínima que demuestre valor, medirla, y dejar que el resultado desbloquee la
> siguiente capa.**

**No serializar rígidamente toda la visión. No construir las versiones finales por adelantado.**

Toda iniciativa en este doc declara explícitamente:

- **capa actual** — qué existe hoy;
- **siguiente capa mínima** — lo más chico que demuestra valor;
- **gate** — qué evidencia hace falta para avanzar;
- **qué queda fuera por ahora** — y por qué;
- **dependencia externa**, si existe;
- **riesgo de construir demasiado pronto**.

La visión (marketplace, economía social) **se conserva como techo, y NO debe contaminar la primera
implementación.**

---

## 6. Frente 1 — Pulir el aprendizaje actual `[FRENTE PRINCIPAL]`

**Capa actual:** ejercicios, progreso por pieza, estrellas, badges y laberintos — **funcionales y en
producción**.

**La prioridad inmediata NO es construir la siguiente capa de contenido. Es pulir la que ya se ve.**

**Próxima capa mínima (L1 — pulido):**
- Mejorar ejercicios: instrucciones y dificultad.
- Definir **qué aborda el usuario primero** en cada sesión; simplificar el primer recorrido.
- **Ocultar contenido que todavía no esté a la altura.** Incluye **mejorar o esconder temporalmente el
  laberinto de peones** si daña la percepción.
- Aprovechar que muchos usuarios **tardan** en desbloquear contenido avanzado: es tiempo regalado para
  pulirlo **antes** de que lleguen.

**Gate:** comprensión y finalización aceptables en el primer recorrido.

**Capas siguientes (NO ahora):**

- **L2 — Juego lúdico propio de cada pieza.** **No todas las piezas deben terminar en un laberinto**, y
  no tienen por qué compartir mecánica:
  - **Caballo**: colocar N caballos, recorrer casillas, llegar a objetivos, evitar repeticiones.
  - **Dama**: colocar N damas sin que se ataquen.
  - **Torre**: laberintos ortogonales, o control de filas y columnas.
  - **Alfil**: laberintos diagonales, o alcance por color.
  - **Rey**: escapar de ataques, llegar a refugio, encontrar casillas seguras.
  - **Peón**: carrera de promoción, avanzar o capturar, cadenas, peones pasados.
- **L3 — Juegos combinados.** Torre + Alfil vs Dama; varias piezas; gana quien termina con más
  material. Introduce valor material, cobertura, intercambios y decisiones tácticas.

**Riesgo de construir demasiado pronto:** hacer los seis juegos por pieza antes de probar uno o dos.
**Gate explícito:** no crear todos los juegos por pieza antes de validar uno. Y no construir juegos
combinados antes de que la progresión individual esté clara.

---

## 7. Frente 2 — Economía básica de Peones `[PARALELO, BARATO]`

### ⚠️ Esto es una HIPÓTESIS, no un diagnóstico

**Nada de lo que sigue está medido.** Se escribe como hipótesis a falsar, no como hecho, y **ninguna
decisión de precio se toma sobre esta base** hasta completar el inventario.

**Hipótesis (planteada por el founder; los números de §3 son lo único leído del código):**

- **H1** — Un ejercicio entrega ~2–3 Peones y los consumos suelen costar ~1. *(Cifras del founder, **no
  verificadas**. Lo que sí se leyó: `PEONES_DAILY_CAP = 6`, `SHIELD_RESCUE_PEONES_COST = 2`,
  `PEONES_WELCOME_PACK_AMOUNT = 1`, `peonesReward: 50` en compras.)*
- **H2** — Hay pocos lugares donde gastarlos; **ganar es más fácil que gastar**.
- **H3 (riesgo, no observación)** — Si H1 y H2 son ciertas, el saldo **podría perder valor
  psicológico**. **Esto NO está observado**: no hay medición de saldo medio, ni de primer gasto, ni de
  percepción. Es el riesgo que el inventario y la medición van a confirmar o descartar.

**⚠️ La respuesta NO es "subir precios".** Primero hay que definir **el ROL de los Peones**: ¿ayudas,
pistas, reintentos, Coach, personalización, acceso a retos, economía social futura?

**Próxima capa mínima:**
1. **Inventariar fuentes y sinks.** No existe hoy. Es la primera tarea y es barata.
2. Añadir **pocos sinks útiles y comprensibles** (2–3).
3. **Medir**: ganado, gastado, saldo medio, y **primer gasto**.
4. **Ajustar precios con evidencia**, no por intuición.

**Regla dura:** **los Peones no compran maestría ni saltean aprendizaje esencial.** Un sink que
permita saltarse el contenido rompe el producto.

**Gate:** gasto real y utilidad percibida.

**Nota de prioridad:** este frente puede ser **más simple** que crear contenido nuevo, pero se evalúa
**por impacto** y **no debe desplazar el pulido del core** (Frente 1).

---

## 8. Frente 3 — Themes progresivos `[PARALELO]`

### T1 — Diferencial visual de PRO `[PRÓXIMA CAPA]`

**El primer objetivo NO es vender themes. Es que una cuenta PRO activa PERCIBA una diferencia visual
clara.** Hoy PRO es, en buena medida, una fecha de vencimiento invisible.

- Activar un **segundo theme**.
- Picker + persistencia de la selección.
- Aplicarlo a **pantallas muy visibles**.
- **Validar** si el theme hace que PRO se sienta distinto y valioso.

**El "builder", en esta capa, es sólo la herramienta que facilita crear y administrar ese diferencial
visual.**

**Gate:** uso real y percepción de valor.

### T2 — Packs en Shop

Si la personalización PRO resulta atractiva: más themes/packs, vendidos en la Shop, con **propiedad
independiente**. Packs posibles: fondos, tableros, marcos, mascotas, celebraciones.

**⚠️ NO asumir que todo theme debe ser PRO.** El entitlement debe soportar:
`default` · `incluido con PRO` · `comprado` · `desbloqueado por logro` · `temporal` · `promocional`.

### T3 — Creadores operados a mano

Si los usuarios compran y usan personalización: creadores externos entregan assets con un **contrato o
plantilla**, **Chesscito revisa y arma/publica** el theme, el creador recibe una parte, Chesscito
retiene un porcentaje. **No hace falta un builder público todavía.**

### T4 — Builder público y marketplace `[TECHO]`

Sólo después de demostrar demanda: subida de assets, composición, preview, validación, envío a
revisión, publicación, revenue share. → `project_theme_marketplace_vision`.

### Las TRES cosas que se llamaron "builder"

Se confundieron dos veces en una sola sesión. **Cuando el founder diga "theme builder", preguntar cuál
de las tres.**

| | Qué es | ¿Cuándo? |
| --- | --- | --- |
| **(a) Catálogo de arte** | Página `/dev` que lista **todas las pantallas, cada slot, sus dimensiones y qué falta**. El founder genera el arte **on-demand** y necesita saber **qué generar** sin ir de a una pieza por vez. | **Infraestructura inicial.** Ataca el cuello de botella real. |
| **(b) Picker** | El usuario elige entre los themes que posee. | **T1** — valida el valor de PRO. |
| **(c) Editor / marketplace** | UI para **componer** themes; terceros suben y venden. | **T4** — fase futura. |

**El cuello de botella de los themes SIEMPRE fue el arte, no el código** — y **(a) es la herramienta
que lo ataca**: convierte *"¿qué assets necesito?"* de una arqueología componente por componente a una
lista con dimensiones. Emparenta con el "asset-presence linter" (Fase E de la foundation).

**Regla del repo:** pedir el arte en **resolución correcta**, **nunca upscalear**.

---

## 9. Frente 4 — Identidad y social login `[INVESTIGACIÓN DE ARQUITECTURA]`

**Celo indicó que esperaban social login para reducir la fricción de crear una wallet.**

**Es infraestructura transversal**: guardado de progreso, recuperación cross-device, ownership,
themes, PRO, Shop, duelos, historial, viewer, regalos. **Todo lo toca.**

**Flujo deseado:**

> entrar → probar → completar algo → **descubrir valor** → guardar con login social → crear o vincular
> wallet

**NO:**

> ~~entrar → registrarse → crear wallet → recién jugar~~

**Gate:** guardado y recuperación confiables.

**Por qué se investiga PRONTO aunque se implemente después:** **afecta la arquitectura de identidad**,
y D1/D2 del duelo dependen de ella. Pero **la implementación puede seguir al pulido del primer loop**.

**Deuda relacionada que hay que resolver antes de que la identidad autorice algo:** `/api/games` acepta
la wallet del body **sin firma** (§3).

---

## 10. Frente 5 — Duelo progresivo

**El duelo NO está congelado.** Se construye **por capas**, con mínimo esfuerzo inicial, y cada capa
sólo se agrega **si la anterior demuestra valor**.

### D1 — Duelo inmediato por enlace `[PRÓXIMA CAPA DEL FRENTE]`

- Un jugador comparte un enlace.
- **Cualquier persona, venga de donde venga, puede abrirlo.**
- Aterriza en `/arena`.
- Ve al jugador que lo invitó como **una opción más**, similar al listado actual de AI Easy / Medium /
  Hard, con un CTA tipo **`JOIN`**.
- **Puede jugar SIN wallet, SIN registro, SIN social login y SIN firma obligatoria inicial.**
- **La experiencia prioriza jugar primero.**

**Hay que resolver una identidad temporal segura — pero NO asumir que wallet = asiento.** Ese supuesto
es exactamente lo que mató a la v2/v3 del spec.

#### Regla técnica dura de D1 (autorización del asiento)

> **Ningún `wallet`, `playerId`, `seatId` ni ningún otro identificador enviado libremente por el
> cliente puede conceder autoridad sobre el asiento.**
>
> **La autorización debe depender de una credencial NO ADIVINABLE emitida por el SERVIDOR.**
>
> **La wallet aparece después, en D2**, para **reclamar o vincular** la partida — nunca para
> autorizar la jugada en D1.

Esta regla no es teórica: es exactamente el defecto que mató a la v2 del spec, y es el mismo que hoy
tiene `/api/games` en producción (`api/games/route.ts:21`, donde el único chequeo es `isAddress()` —
valida el **formato, no la propiedad**). **Un identificador que el cliente elige no es una
credencial.**

#### De qué SÍ depende D1

**D1 NO depende del listado de MiniPay, ni de MiniPay en absoluto.** Pero **sí depende de una
experiencia web móvil universal**: `/arena?challenge=...` **debe abrir y permitir jugar desde un
navegador común o desde la PWA**, venga el jugador de donde venga (WhatsApp, Telegram, un SMS, un
navegador de escritorio). **Si el enlace sólo funciona dentro de un entorno con wallet, no es D1.**

> ⚠️ **El spec v3 vigente (`docs/specs/2026-07-13-async-link-duel-spec.md`) NO describe D1.** Describe
> un duelo **wallet-first con sesión firmada**. Sigue siendo valioso por su árbitro, su modelo de
> expiración, su matriz de estados y su red-team — pero **su modelo de identidad contradice a D1** y
> hay que **reescribirlo para esta capa**.

**Gate:** uso real del duelo. *(Señales y umbrales concretos se definen antes del experimento — ver
§14.)*

### D2 — Guardar partida

Si el duelo básico funciona: *"Guardá tu partida"* → conectar o crear identidad → asociar un address →
recuperar la partida después → persistir historial y resultado.

> **La wallet aparece como VALOR AGREGADO, no como barrera de entrada.**

### D3 — Viewer

Si guardar y compartir funciona: compartir el enlace de la partida, vista para espectadores (tablero,
jugadores, estado, resultado). **Empezar simple — no hace falta tiempo real sofisticado.**

### D4 — Fans

Si realmente hay espectadores: seguir o apoyar a un jugador, reacciones o señales de apoyo. **Validar
si existe comportamiento de audiencia.**

### D5 — Economía social `[TECHO]`

**Sólo si los viewers se convierten en fans:** enviar Peones, Alfiles, Caballos u otros consumibles;
economía **jugador → jugador**; comisión o porcentaje; y definir **límites, abuso, settlement y consumo
posterior**. → `project_duel_spectator_economy`.

**La visión de espectadores y regalos se conserva como TECHO. No debe contaminar D1.**

**Riesgo de construir demasiado pronto:** el poll con backoff que diseñó el spec v3 alcanza para dos
jugadores por turnos; **no** alcanza para una tribuna. Diseñar para la tribuna en D1 es sobre-construir.

---

## 11. Dependencias externas — MiniPay

**Estado real (2026-07-13):** **la app YA fue enviada y está EN REVISIÓN.**

**Hoy NO existen cambios oficialmente solicitados por MiniPay que debamos ejecutar.** Estamos
esperando que aprueben, pidan ajustes, rechacen, o indiquen cómo sigue el proceso.

**Qué es MiniPay, entonces:**
- **Canal de distribución.**
- **Dependencia externa para validar el deep link nativo.**
- **Proceso en observación.**
- **NO es un bloqueo general del roadmap.**

**Para qué importa el listado, concretamente:** para **validar el deep link** que abre Chesscito
**dentro** de MiniPay. Aunque exista el schema o el mecanismo, **mientras Chesscito no esté listado no
se puede validar** que un enlace externo abra Chesscito dentro de MiniPay **preservando parámetros
como `challenge`**.

**Ése es el ÚNICO punto donde el duelo toca a MiniPay — y D1 no lo necesita.** D1 se juega **sin
wallet**, así que **no depende del listado ni de MiniPay**. De lo que **sí** depende D1 es de una
**experiencia web móvil universal**: `/arena?challenge=...` tiene que **abrir y dejar jugar desde un
navegador común o desde la PWA**. El deep link nativo es una **optimización posterior** para los
usuarios que ya estén en MiniPay — **no es el camino de entrada**.

**Cuando aprueben:** correr `apps/web/src/app/dev/duel-link-probe/page.tsx` desde WhatsApp, desde el
navegador del sistema, y desde adentro de MiniPay. **Captura de cada uno.**

**Contexto histórico (NO son pendientes oficiales abiertos):** hubo feedback de un reviewer en una
llamada del **2026-07-03** — landing con onboarding + links legales visibles; información clara de
Challenges/PRO; experiencia inicial más simple (`project_minipay_listing_feedback_2026_07`). **Ese
feedback impulsó trabajo que ya se hizo.** Las mejoras de onboarding, PRO, Challenges o simplificación
**pueden seguir siendo valiosas para el producto**, pero **NO deben presentarse como pendientes
oficiales del reviewer salvo que haya evidencia escrita vigente.**

**Y lo más importante:** **Chesscito debe seguir mejorando y preparándose para existir también en
web/PWA u otros canales, incluso si el listado tarda o no ocurre.**

---

## 12. Qué está activo, qué está en preparación y qué está diferido

**Activo (frente principal)**
- Frente 1 — pulido del aprendizaje: ejercicios, primera sesión, ocultar lo débil.

**Trabajo paralelo barato**
- Frente 2 — inventario de fuentes/sinks de Peones + 2–3 sinks útiles.
- Frente 3 / T1 — catálogo de arte (a) + theme PRO visible (b).

**Investigación de arquitectura**
- Frente 4 — identidad progresiva / social login.

**En preparación (con spec, sin código de producto)**
- Frente 5 / D1 — duelo mínimo por enlace, **sin wallet**. Requiere **reescribir el spec** (el v3 es
  wallet-first y contradice a D1).

**Dependencia externa, en observación**
- MiniPay — en revisión. Probe lista para el día que aprueben.

**Diferido (techo, NO construir)**
- L2 / L3 (juegos por pieza, juegos combinados) · T2/T3/T4 (packs, creadores, marketplace) ·
  D2–D5 (guardado, viewer, fans, economía social).

**Arrastrado (no se olvide)**
- **Smoke del Hub Tour en MiniPay real** — pendiente desde 2026-07-12.
- **Belt System** — aceptado, no agendado. Bloqueado por la decisión de *server-verified progress*.
- **`/api/games` sin firma** — deuda de seguridad conocida (§3).

---

## 13. Orden de ejecución recomendado

**No es una cascada absoluta.** Es un orden de prioridad con carriles paralelos.

1. **Pulir ejercicios, primera sesión y contenido ya visible.** `[frente principal]`
2. **Corregir la utilidad básica de Peones y consumibles.** `[paralelo barato]`
3. **Activar un theme PRO visible y validar la personalización.** `[paralelo barato]`
4. **Preparar identidad progresiva y social login.** `[investigación de arquitectura]`
5. **Lanzar el duelo mínimo por enlace, sin wallet obligatoria.** (D1)
6. **Introducir juegos lúdicos específicos por pieza.** (L2 — empezar por **uno o dos**)
7. **Añadir guardado de duelos y viewer.** (D2, D3)
8. **Packs de themes, fans y regalos** — **sólo después de señales reales.** (T2, D4)
9. **Marketplace de themes y juegos combinados** — **cuando exista evidencia suficiente.** (T4, L3)

---

## 14. Gates de avance

**Ninguno de estos se cruza por intuición. Cada uno pide evidencia.**

### ⚠️ Los gates cualitativos necesitan señales y umbrales — que NO se inventan acá

Varios gates de este doc están escritos en lenguaje cualitativo: *"comprensión aceptable"*, *"uso
real"*, *"percepción de valor"*, *"gasto real"*, *"señales reales"*, *"evidencia suficiente"*.

**Eso es deliberado: son marcadores de posición, no criterios.** Un número inventado hoy, sin
instrumentación y sin línea de base, sería falsa precisión — y peor que la ambigüedad, porque parecería
medido.

**La regla:** **antes de cada experimento se definen sus señales concretas y sus umbrales** (qué se
mide, con qué instrumento, contra qué línea de base, y qué valor cuenta como cruzar el gate). **Esa
definición es parte del trabajo del experimento, no de este documento.** Ningún gate se declara cruzado
sin ella.

- ❌ **No vender themes** hasta que el theme PRO sea **visible y utilizado**.
- ❌ **No construir marketplace** hasta que existan **compras reales** de personalización.
- ❌ **No construir builder público** antes de **operar manualmente** themes de terceros.
- ❌ **No añadir viewer** hasta que **el duelo básico se use**.
- ❌ **No añadir regalos** hasta que **haya espectadores**.
- ❌ **No diseñar economía social** hasta **validar fans**.
- ❌ **No crear todos los juegos por pieza** antes de probar **uno o dos**.
- ❌ **No construir juegos combinados** antes de que **la progresión individual esté clara**.
- ❌ **No bloquear la primera partida** por wallet o social login.
- ❌ **No depender del listado de MiniPay** para seguir mejorando Chesscito.
- ❌ **No subir precios de Peones** antes de **inventariar fuentes y sinks y medir el primer gasto**.
- ❌ **No usar Peones** para comprar maestría o saltarse aprendizaje esencial.

---

## 15. Qué NO construir todavía

- **Un editor/builder público de themes.** (T4 — sin demanda demostrada.)
- **Modo espectador, fans o regalos en el duelo.** (D3–D5 — sin un duelo que se use.)
- **Los seis juegos por pieza.** (L2 — probar uno o dos primero.)
- **Juegos combinados.** (L3.)
- **El duelo wallet-first con sesión firmada** tal como lo describe el spec v3 — **D1 se juega sin
  wallet**. El spec v3 se conserva por su árbitro, su expiración, su matriz y su red-team, **no por su
  modelo de identidad**.
- **Cualquier cosa que dependa del deep link de MiniPay** antes de que el listado permita validarlo.

---

## 16. Documentos y código que preservan contexto

**Specs y research**
- `docs/specs/2026-07-13-async-link-duel-spec.md` — spec v3 del duelo (**wallet-first**; contradice a
  D1, ver §10).
- `docs/specs/2026-07-13-async-link-duel-redteam.md` — red-team v3, trazabilidad v1→v2→v3.
- `docs/superpowers/specs/2026-05-26-theme-system-foundation.md` — arquitectura, monetización,
  playbook de adopción, checklist de superficies.
- `docs/product/2026-06-24-minipay-celo-primitives-research.md` — **líneas 75-80**: MiniPay no tiene
  primitiva de link compartible; el único deeplink documentado es el de depósito.
- `docs/backlog/2026-07-10-backlog-index.md` — **backlog canónico**, auditado contra el código.

**Código**
- `apps/web/src/lib/themes/` — foundation de themes (dormida).
- `apps/web/src/app/dev/duel-link-probe/page.tsx` — probe de MiniPay (construida, verificada).
- `apps/web/src/lib/coach/validate-game.ts` — árbitro server-side (reusable para D1).
- `apps/web/src/components/arena/arena-board.tsx` — tablero **100% presentacional**.
- `apps/web/src/app/api/games/route.ts` — **línea 21: la deuda de seguridad.**

**Memoria**
- `project_theme_system_foundation` · `project_theme_marketplace_vision` ·
  `project_duel_spectator_economy` · `project_minipay_listing_feedback_2026_07` ·
  `project_exercise_rotation` · `project_peones_economy_no_rush_sinks` ·
  `feedback_suspect_your_derivation_first` · `feedback_vr_green_can_photograph_an_error`

**⚠️ Estimaciones históricas — verificar contra el código actual antes de usarlas para planificar.**
El roadmap de themes (`project_theme_system_foundation`, escrito **2026-05-26**) estima Fase A ~5 min,
Fase C ~2 h, Fase D ~3–4 h. **Son estimaciones de hace ~7 semanas, no mediciones.** Este documento **no
inventa tiempos nuevos** para ningún frente.

---

## 17. Directriz consolidada

> **El frente principal es pulir el aprendizaje que ya se ve: ejercicios, primera sesión, y esconder
> lo que todavía no está a la altura.** Todo lo demás avanza en paralelo, por capas, y sólo cuando su
> gate se cruza.

En paralelo, y en este orden de prioridad:

- **Peones** — inventariar fuentes y sinks, agregar 2–3 usos claros, **medir antes de tocar precios**.
- **Themes** — catálogo de arte primero; después un theme PRO **visible**, para validar si la
  personalización hace que PRO se sienta valioso.
- **Identidad** — investigar social login progresivo: es transversal y condiciona al duelo.
- **Duelo** — **por capas**. D1 es abrir un enlace y jugar, **sin wallet**. Viewer, fans y economía
  social son el **techo**, y sólo llegan si la capa anterior demuestra uso real.
- **MiniPay** — en revisión. Es un **canal**, no un bloqueo. Lo que espera al listado es **el deep
  link nativo**, no el producto.

Y el principio que atraviesa todo:

> **Construir la capa mínima que demuestre valor, medirla, y dejar que el resultado desbloquee la
> siguiente.**

**Cuando aparezca una idea nueva, este doc debe poder responder:**
¿A qué frente pertenece? · ¿En qué capa estamos? · ¿Cuál es la siguiente capa mínima? · ¿Qué evidencia
necesitamos? · **¿Nos estamos adelantando?** · ¿Qué contexto histórico no hay que olvidar? · ¿Qué
código o documento ya existe? · ¿Qué depende de un tercero?

---

## Apéndice — Qué afirmaba la versión anterior y NO estaba respaldado

Auditoría honesta de la v1 de este doc (mismo día). **Tres afirmaciones no tenían respaldo:**

1. **"El listado de MiniPay es lo único que tiene reloj"** y **"todo lo demás depende de esto"** —
   **SIN RESPALDO.** La app está **en revisión** y **no hay pedidos oficiales abiertos**. Presenté un
   feedback de una llamada del 2026-07-03 (que ya impulsó trabajo hecho) como si fuera una lista de
   pendientes vigentes. **Era una inferencia mía, no un hecho.**
2. **"El duelo está CONGELADO"** — **CONTRADICE LA INTENCIÓN DEL FOUNDER.** Deduje el congelamiento de
   un bloqueo técnico real (el deep link) y lo extendí a **toda** la feature. La intención siempre fue
   **construirlo por capas**, y **la capa D1 no necesita el deep link ni la wallet**. El bloqueo era de
   **una capa**, no del frente.
3. **"Construirlo ahora es un embudo viral sin vector"** — **razonamiento válido, conclusión
   demasiado ancha.** Aplica a un duelo **wallet-first dependiente del listado**; **no** aplica a D1,
   que cualquiera puede abrir y jugar desde donde sea.

**Afirmaciones de la v1 que SÍ estaban respaldadas y se conservan:** la trazabilidad v1→v2→v3 del
spec; la deuda de `/api/games:21`; la ausencia de deeplink documentado
(`2026-06-24-minipay-celo-primitives-research.md:75-80`); la foundation de themes shipped-y-dormida;
la distinción catálogo / picker / builder; y que **el cuello de botella de los themes es el arte**.

**Afirmación del founder que este doc registra pero NO verificó contra el código:** *"un ejercicio
entrega ~2–3 Peones, los consumos cuestan ~1"*. Lo que **sí** se leyó del código (§3):
`PEONES_DAILY_CAP = 6`, `PEONES_COST = 2` (shield fallback), `PEONES_WELCOME_PACK_AMOUNT = 1`,
`peonesReward: 50` (compra). **El inventario completo es la primera tarea del Frente 2.**
