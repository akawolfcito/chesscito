# Hallazgos de UX en vivo (MiniPay listado) — 2026-08-06

> Capturas del founder sobre el build listado, más Lighthouse y probes contra prod.
> **Cinco frentes.** Cuatro de diseño y uno de performance — y el de performance manda:
> está medido, tiene una causa de una línea, y hasta que se arregle los otros cuatro
> discuten copy sobre una pantalla que el jugador no llega a ver.
>
> El único que parecía defecto de datos (Leaders) **quedó cerrado midiendo**: la captura
> estaba vencida.
>
> ⚠️ **Este doc registra dos hipótesis mías que resultaron falsas** —que Leaders estaba roto
> y que la culpa de la lentitud era de las imágenes—. Las dejo escritas con su refutación:
> el valor está en no volver a recorrerlas.

---

## 1. "Come Back Tomorrow" — un botón que dice *andate*

**Lo que ve el jugador.** Completa **un** ejercicio (el Daily) y el CTA primario del hub —
verde, elevado, del mismo tamaño que el botón con el que acaba de entrar— pasa a decir
**"Come Back Tomorrow"**. Debajo, en gris chico: *"Training stays open. Keep improving your
scores."*

**Lo que el código ya sabe.** `challenge-card.tsx:472`:

> «`tomorrow` y `complete` son **STATUS text wearing the CTA**»

O sea: ya está escrito que no es un botón. Pero **se viste de botón**, y en móvil la ropa
manda sobre la semántica. El jugador no lee la nota gris; lee el objeto verde grande.

**Por qué duele más de lo que parece.** El caso que el founder describe es el peor y el más
común: alguien que **nunca entró al Training Path**. Para esa persona el hub dice, con la
única pieza jerárquicamente dominante de la pantalla, que **ya no hay nada que hacer hoy**.
El ritual se apaga en el día 1. El "Training stays open" que lo desmiente está en gris, a
11 px, debajo. Es la letra chica contradiciendo al titular.

**La comparación que lo prueba.** El slot equivalente en la otra captura (ES) ya **no** es
un botón: es el **banner del Season Pass** — icono, título, subtítulo de 3 beneficios,
precio en badge, chevron. Ese slot **convierte**. El founder lo llama acierto y tiene razón:
un banner **ofrece un siguiente paso**; un botón deshabilitado **cierra la sesión**.

### Cómo lo resolvería

Regla: **ningún estado terminal ocupa el slot del CTA primario con forma de botón.** El
estado `tomorrow` no es un CTA — es un *recibo* + una *invitación*.

Composición propuesta para el slot, en dos piezas:

1. **Recibo (chip, no botón)** — pequeño, ancho de contenido, no full-width:
   `✅ Focus done · Day 6 of 21`. Confirma sin ocupar la jerarquía del CTA.
2. **Banner de continuidad (ocupa el slot del botón)** — con la MISMA anatomía del banner
   de Season Pass, porque esa anatomía ya está validada: icono + título + subtítulo +
   chevron. Su destino depende del estado real del jugador:

| Estado del jugador | Banner | Destino |
|---|---|---|
| Nunca entró al Training Path | **Start your Training Path** · *Rook — 6 lessons* | `/exercises` con la pieza nombrada |
| Path empezado, pieza a medias | **Continue: Bishop** · *3 of 6 · 2★ to next badge* | La lección exacta |
| Path al día, sin Season Pass | **21-day Season Pass** (el actual) | Sheet de compra |
| Todo al día y con pass | **Beat your best** · *Rook · 1,200 → your record* | Mejor score mejorable |

⚠️ **Esto NO es sólo copy.** Es un cambio de *forma* (botón → banner) más una **decisión de
destino por estado**. El spec debe enumerar los cuatro estados y qué pasa al tocar cada uno
— sin esa enumeración, los bugs de flujo aparecen en QA (regla de CLAUDE.md).

⚠️ **A verificar antes de escribir el spec:** hoy existen cuatro `CtaState`
(`join | start | tomorrow | complete`). Hay que confirmar cuál renderiza la captura y si
`complete` sufre lo mismo. Y el mismo patrón hay que auditarlo en **todo** botón terminal
de la app, no sólo en este — el founder sospecha que hay más y probablemente los hay.

---

## 2. Leaders vs `/stats` — ✅ RESUELTO: la captura estaba vencida

> ⛔ **Leé primero el bloque "RESUELTO" más abajo.** Lo que sigue hasta ahí es mi lectura
> **original**, escrita antes de medir, y la dejo a propósito: la hipótesis era razonable y
> resultó equivocada. La conclusión real está al final de la sección.

**Primero, lo que NO está mal.** Que LEADERS (weekly, 4 jugadores, tope 5.500) no se parezca
a `/stats` (all-time, 487 jugadores, tope 14.900) es **correcto**: responden preguntas
distintas y así fue diseñado (`20260801000000_leaderboard_weekly.sql`). Weekly agrega
`score_attempts` de la semana en curso y por superficie; `/stats` es all-time global.

**Ahora, lo que sí está mal.** Dentro de la MISMA pestaña THIS WEEK, la captura dice tres
cosas que no pueden ser ciertas a la vez:

- El hero declara **4 players**.
- El footer fijado declara que sos el **#13**.
- El footer marca **2.000 pts**, mientras la fila #2 de la lista — **el mismo jugador,
  mismo nickname, y resaltada como propia** — marca **1.700**.

Un rango 13 dentro de una población de 4 es imposible. Y 2.000 puntos rankeados *por debajo*
de 1.700 es imposible en cualquier ranking ordenado por score. **No es una diferencia de
ventana: es una contradicción interna de un solo payload.**

**Lo que ya descarté leyendo el código local (`main`, 22 commits sin pushear):**

- `get_weekly_leaderboard` y `get_weekly_player_rank` **leen la misma relación**
  (`weekly_ranking`) con los mismos argumentos — la migración explícitamente evita las tres
  copias del `rank() over` justamente porque «el síntoma es un footer que discrepa de la
  lista».
- El route (`api/leaderboard/route.ts`) resuelve lista, propio y total **en el mismo
  `Promise.all`**, con la misma `surface` y la misma ventana.
- El cliente guarda `ownRow` **por pestaña**; no puede pintar el propio de all-time bajo la
  lista weekly.

**Conclusión honesta: el código que leí no produce esa pantalla.** Entonces la causa está en
uno de estos tres lugares, y hay que **medirlo, no deducirlo**:

1. **Drift de versión** — el build listado es anterior a alguno de esos arreglos. Es la
   hipótesis más barata y la primera a descartar: hay 22 commits sin pushear.
2. **La base de prod** no tiene las funciones que la migración local describe (el esquema de
   prod ya demostró drift antes).
3. **Colisión de nickname** — el nombre visible es `variante + 4 dígitos`. Con 487 jugadores
   la colisión es casi segura, así que **dos wallets distintas pueden verse iguales**. Esto
   explicaría los nombres repetidos, pero **no** el "#13 entre 4 jugadores": ese sigue roto.

### ✅ RESUELTO por probe contra prod (2026-08-06)

Cuatro llamadas reales. **La pantalla de la captura no existe hoy en ningún entorno.**

| Entorno | `total` | Campeón | Ventana |
|---|---|---|---|
| `learn.chesscito.com` weekly | **471** | 14.600 | 2026-08-03 → 08-10, `surface: learn` |
| `learn.chesscito.com` alltime | — | 14.900 | global |
| `play.chesscito.com` weekly | 0 | — | `surface: play` (nadie juega esa superficie) |
| `learn-preview` / `preview` | idénticos a prod | | |

Ningún board devuelve "4 players", ni un campeón de 5.500, ni una `Bright Queen #1080`.
Prod hoy es **coherente**: 471 jugadores rankeados esta semana en LEARN.

**Y la captura tiene una firma que la fecha.** `lib/server/leaderboard.ts:61` documenta el
defecto **anterior** con estas palabras:

> «el hero imprimía `rows.length`, el tamaño del corte de top-10 […] una afirmación falsa en
> pantalla **al lado de un footer que decía rank 13**»

Rank 13 junto a una población diminuta **es exactamente esa captura**. Es el estado
pre-arreglo, y el arreglo (`total` contado sobre la relación sin cortar) **ya está vivo** —
por eso prod devuelve 471 y no 10.

⛔ **Conclusión: la captura está vencida, no hay defecto que perseguir.** Queda una sola
confirmación, y es de 10 segundos en el device: **reabrir LEADERS en el build actual.** Si
el hero dice ~471 y el footer da un rango plausible, esto se cierra.

⚠️ **Lo que el probe SÍ dejó, y no es un bug:** el board weekly de LEARN (14.600) y el
all-time (14.900) son **casi el mismo board, con el mismo campeón**. Con el listing recién
salido, todo el histórico cabe dentro de esta semana. Las dos pestañas se ven iguales, así
que hoy **THIS WEEK / ALL TIME no le dice nada al jugador**. No se arregla con código: se
arregla con tiempo, o eligiendo no mostrar dos pestañas hasta que diverjan.

⚠️ **Nota menor, sin impacto hoy:** el board all-time **no está scopeado por superficie**
(`fetchLeaderboard()` no toma `surface`), mientras el weekly sí. Es inocuo mientras `play`
no tenga intentos — hoy tiene cero. Y el dock de PLAY no consume este endpoint: su sheet lee
`/api/hall-of-fame` (victorias), no el ranking de entrenamiento. Anotado por si PLAY empieza
a producir scores.

⚠️ Aparte, hay un problema de **narrativa** aunque los datos se arreglen: el jugador ve
"4 players" adentro y 487 en `/stats`. Si nunca se declara que uno es *esta semana en
LEARN* y el otro *histórico global*, el número chico se lee como "acá no juega nadie". El
encabezado de la pestaña tiene que decir la ventana **y la superficie**, no sólo "THIS WEEK".

---

## 3. El Daily de PLAY HUB quedó en el vocabulario viejo

**Lo que ve el jugador.** Resuelve el Daily Tactic en PLAY y el cierre es: tablero verde
plano, `⭐ SOLVED!` en texto, `Streak: 2`, `+1 day`, `+1 Peones` apilados como una lista, y
`Share Result` como **link subrayado**. Es una *página de resultados*, no una celebración.

**El contraste.** LEARN ya tiene sistema de overlays de celebración con headline arqueado
compartido. PLAY no lo usa. El mismo jugador, la misma app, dos idiomas visuales según por
qué puerta entró — y PLAY es justamente la puerta del listing de MiniPay.

**Cómo lo resolvería.** No inventar nada: **portar** el overlay de celebración existente a
la superficie PLAY. Concretamente:

- Headline arqueado en lugar de `⭐ SOLVED!` plano.
- Las tres recompensas como **fichas** con su icono canónico (racha, día, Peones), no como
  tres líneas de texto.
- `Share Result` deja de ser link y pasa a ser botón secundario — es la única acción de
  crecimiento de esa pantalla y hoy tiene el peso visual de un pie de página.
- Y el mismo tratamiento del punto 1: **el cierre necesita un siguiente paso**, no sólo un
  ✕ arriba a la derecha.

⚠️ Antes de tocar nada: auditar por qué PLAY no consume ese sistema. Si es porque el overlay
vive acoplado a LEARN, el trabajo real es **extraerlo**, y eso cambia el tamaño de la tarea.

---

## 4. Lúdicos y aprendizaje sin umbral entre medio

**Lo que ve el jugador.** Termina la última lección de una pieza y **cae** en un laberinto.
Sin corte, sin anuncio, sin pantalla de por medio. Nadie le dijo que desbloqueó algo ni que
cambió de tipo de actividad. El founder lo describe exacto: *"el usuario se siente algo dudoso
de qué pasó"*.

**Por qué importa más que el resto.** Los dos carriles por pieza son la promesa del producto:
aprendés el movimiento, después **jugás** con él. Si la transición es invisible, la recompensa
también lo es. Se desbloqueó un juego y se sintió como "el siguiente ejercicio". Se está
regalando el único momento de la sesión que genera orgullo.

**Cómo lo resolvería.** Un **umbral**, no una pantalla de carga (una pantalla de carga informa
que el sistema trabaja; acá hay que informar que el *jugador* logró algo):

1. **Sello de cierre del carril 1** — "Rook: movement mastered", con las estrellas obtenidas.
2. **Revelación del desbloqueo** — el laberinto **nombrado**, con su arte, presentado como
   premio: *"You unlocked: Rook Labyrinth"*. Un nombre propio convierte una pantalla más en
   una cosa que se cuenta.
3. **Entrada explícita** — un botón para entrar y **una salida** para no entrar ahora
   (vuelve al hub sin perder el desbloqueo). El desbloqueo persiste; no es ahora-o-nunca.
4. **Marca de tipo dentro del juego** — que el laberinto se anuncie a sí mismo como juego,
   no como ejercicio: encabezado distinto o color distinto. La duda no aparece sólo en la
   transición, sigue adentro.

⚠️ Este es el único de los cuatro que probablemente sea **pantalla nueva**, no ajuste. Merece
spec propio con todos los estados enumerados (¿y si vuelve a entrar mañana? ¿y si ya lo
completó? ¿y si desbloquea dos laberintos seguidos?).

---

## 5. Performance — 85 → 45, y la culpa **no** es de las imágenes

> Frente agregado el 2026-08-06 con Lighthouse real sobre `play.chesscito.com` + probes
> propios contra prod. **Este entra arriba de todo lo anterior**: un hub que tarda varios
> segundos hace irrelevante el debate del CTA, porque el jugador ya se fue.

### Lo que miden las dos corridas de Lighthouse

| Métrica | Corrida A | Corrida B |
|---|---|---|
| Performance | **45** | **45** |
| FCP | 2,6 s | 4,5 s |
| **LCP** | **18,2 s** | **17,7 s** |
| TBT | 1.120 ms | 570 ms |
| Speed Index | 4,8 s | 7,7 s |
| CLS | 0 ✅ | 0 ✅ |

Diagnósticos, en orden de tamaño:

- **Reduce unused JavaScript — 981 KiB.** El titular, por lejos.
- Avoid enormous network payloads — **2.862 KiB** totales.
- Minimize main-thread work — **2,6 s** · Reduce JS execution time — **1,6 s**.
- Reduce unused CSS — 77 KiB · Legacy JavaScript — 20 KiB.
- Render-blocking — 300 ms (dos CSS, 58,8 KiB + 1,7 KiB).

### ⛔ Descarté la hipótesis obvia: NO son las imágenes

Empecé por ahí y me equivoqué. Los PNG del repo asustan —`pro-suscription-icon.png` pesa
**1,0 MB**, `season-pass-icon.png` **890 KB**, `favicon-wolf.png` **635 KB**— y
`season-pass-icon` se renderiza **en el hub** (`challenge-card.tsx:528`), justo la pantalla
lenta. Pero `ThemeAssetPicture` emite `<source>` AVIF y WebP, y el PNG es sólo el fallback.
Medido contra prod:

| Asset | AVIF | WebP | PNG (fallback) |
|---|---|---|---|
| `season-pass-icon` | **16 KB** | 46 KB | 890 KB |
| `pro-suscription-icon` | **30 KB** | 89 KB | 1.016 KB |

Un browser real baja **16 KB**, no 890. **El pipeline de imágenes ya está bien** donde pasa
por el resolver. ⚠️ Lo que sí queda por auditar es qué assets **lo esquivan** — ya es una
clase de bug conocida del repo (un `/art/...` escrito en JS que no pasa por el resolver).
Pero no es la causa del 45.

### La causa real: el stack de wallet está en el camino crítico

Tres evidencias que apuntan al mismo lugar:

1. **El elemento LCP es `<h1 class="web-access-headline">`** — texto plano — con
   **TTFB de 10 ms y *render delay* de 2.670 ms.** Un titular de texto que tarda 2,7 s en
   pintar no está esperando la red: está esperando que corra JavaScript.
2. **Los tres candidatos a `preconnect` que sugiere Lighthouse** son `privy.chesscito.com`,
   `auth.privy.io` y `explorer-api.walletconnect.com`, 300 ms cada uno. Es decir: Privy y
   WalletConnect **se contactan durante la carga inicial**, y sin `preconnect`.
3. `next/image` aparece en **0 de 367 componentes**, así que no hay nada del lado de imágenes
   que explique 981 KiB de JS sin usar. Es código, no arte.

⚠️ **Matiz importante sobre el 45.** Ese Lighthouse corrió sobre `play.chesscito.com` en un
Chrome de laboratorio, o sea **sin MiniPay**: la pantalla que midió es el *gate* de web
access de Privy, no el hub. El jugador de MiniPay nunca ve esa pantalla. **Pero el 45 y la
lentitud que sentís comparten causa** — el mismo bundle de wallet — así que arreglarlo
mueve las dos agujas. Sólo hay que saber que **el 45 no es la nota del hub**, y que subirlo
no prueba por sí solo que el hub mejoró.

### Un hallazgo aparte, del lado del servidor

Probes propios contra `learn.chesscito.com`:

| Ruta | Código | TTFB |
|---|---|---|
| `/` | 200 | 0,80 s |
| `/es` | 200 | 0,82 s |
| **`/en`** | **307** | **23,3 s** (y 16 s de timeout en el intento previo) |
| `/en/exercises` | 307 | 2,3 s |

Un **redirect** que tarda 23 segundos no es bundle: es servidor. Huele a cold start de la
función. Dos muestras no son una medición, pero 23 s y 16 s no son ruido tampoco. **Vale una
medición aparte**, y no compite con el trabajo de JS.

### ✅ MEDIDO: el build responde, y la causa es una línea

`pnpm -C apps/web build`, EXIT=0. First Load JS por ruta:

| Ruta | Size | **First Load JS** |
|---|---|---|
| `/[locale]` (la entrada tras el último slide) | 31,2 kB | **382 kB** |
| `/[locale]/exercises` | 47,6 kB | **454 kB** |
| `/[locale]/arena` | 23,1 kB | **415 kB** |
| `/[locale]/hub` (stub de redirect) | 161 B | 89,3 kB |
| *shared by all* | — | **89,1 kB** ✅ |

El chunk compartido está **sano**. El peso está en las rutas. Los chunks más gordos del build:

| Chunk | Sin comprimir | Contiene |
|---|---|---|
| `1515-…js` | **1.490.500 B (1,49 MB)** | walletconnect · privy · viem · wagmi · ethers · @reown · coinbase |
| `7a7377a5-…js` | **707.728 B** | walletconnect · privy · ethers · coinbase |
| `2520-…js` | 504.121 B | walletconnect · viem · wagmi · coinbase |

**Y acá está el golpe.** Le pregunté al `app-build-manifest.json` quién carga esos dos:

```
/[locale]/page            -> (ninguno de los tres)
/[locale]/exercises/page  -> (ninguno de los tres)
/[locale]/layout          -> 7a7377a5-…js | 1515-…js   ← 2,2 MB
```

**Los cargan el ROOT LAYOUT.** O sea: **todas** las rutas del app bajan los ~2,2 MB del stack
de wallet. `/stats`, `/about`, `/terms`, `/privacy`, las páginas de share — todas. Eso son
los 981 KiB "sin usar" de Lighthouse, y es exactamente por qué un `<h1>` de texto tarda
2,67 s en pintar: el hilo principal está parseando wallet.

### La línea

`components/wallet-provider-boundary.tsx:6-7`:

```ts
import { WalletProvider }    from "@/components/wallet-provider";      // MiniPay / injected
import { WebWalletProvider } from "@/components/web-wallet-provider";  // Privy web
```

Dos imports **estáticos**. El componente monta **exactamente uno** en runtime —esa es toda
su razón de existir— pero el bundler no puede saberlo, así que empaqueta **los dos** en el
layout. Todo visitante baja las dos ramas para usar una.

Y el comentario de la línea 12 dice que `NEXT_PUBLIC_PRIVY_ENABLED` está **apagado en
producción**. Si eso sigue siendo cierto, la rama Privy **nunca corre** — y aun así viaja
entera, en cada ruta, para cada jugador.

### ⛔ AUDITORÍA DE ENV: el comentario miente, y eso cambia el plan

`vercel env ls` sobre los dos proyectos, **sin filtrar por entorno**:

| Proyecto | `NEXT_PUBLIC_PRIVY_APP_ID` | `NEXT_PUBLIC_PRIVY_ENABLED` |
|---|---|---|
| `chesscito` (PLAY) | Production, Preview | **Production, Preview** |
| `lite-chesscito` (LEARN) | Production, Preview | **Production, Preview** |

Los valores están cifrados, así que la lista sola no dice si es `"true"`. **Lo resolví
renderizando**: Playwright contra los dos dominios de producción, viewport 390 px, UA
Android.

```
https://play.chesscito.com/    web-access-headline: 1   JS: 6.817 KB en 68 requests
https://learn.chesscito.com/   web-access-headline: 1   JS: 6.817 KB en 68 requests
```

Las dos pintan **"Unlock your Chesscito journey · Sign in to enter"**. ⛔ **Privy está
ENCENDIDO en producción en los DOS proyectos.** El comentario de
`wallet-provider-boundary.tsx:12` —«Off in production»— **está vencido**.

**Esto invalida la mitad optimista de mi propuesta anterior.** Yo dije: "en producción con
Privy apagado, la rama web cae a cero bytes". **Falso.** Ninguna de las dos ramas es código
muerto; las dos se usan de verdad. Así que el fix **no** es borrar una rama: tiene que ser
code-splitting real, y el ahorro es *"cada visitante baja una rama en vez de dos"*, no
*"desaparece Privy"*.

**Los tres scripts más pesados que baja un visitante web:**

| | |
|---|---|
| `1515-…js` | **1.456 KB** ← el chunk del root layout |
| `7a7377a5-…js` | **691 KB** ← ídem |
| `292` + `9289` + `3102` | ~1.035 KB, con el mismo `dpl=` en ambos hosts → son los bundles propios de Privy |

⚠️ **Y el matiz que más importa:** esa medición es del camino **web**, no de MiniPay. Un
jugador de MiniPay toma la rama `injected` y **nunca monta Privy** — pero como los dos
providers son imports **estáticos** del layout, **igual se baja los 2,1 MB de `1515` +
`7a7377a5`**. Paga por código que en su sesión no se ejecuta jamás. Eso es, literalmente, lo
que sentís al salir del último slide.

### El fix, y su riesgo honesto

Pasar esos dos imports a carga diferida (`next/dynamic`), para que baje **sólo la rama que
se resuelve**. Con Privy encendido en las dos superficies, el ahorro concreto es: el jugador
de **MiniPay** deja de bajar la rama de Privy, y el visitante **web** deja de bajar la rama
injected. Cada uno paga una, no dos.

✅ A favor: el `undecided` shell **ya existe** — el componente ya tiene un estado estable en
el que no hay ningún provider montado, esperando hidratación. Un import diferido encaja en
ese hueco en vez de inventar uno.

⚠️ En contra: este archivo existe para evitar un doble montaje de wagmi y un mismatch de
hidratación. Cualquier cambio tiene que **preservar esa invariante**, y merece tests antes
que código.

### El resto, en orden

1. **Diferir las dos ramas de wallet** — el fix de arriba. Es el 90 % del problema.
2. **`preconnect`** a `privy.chesscito.com`, `auth.privy.io`, `explorer-api.walletconnect.com`
   — 300 ms cada uno, dos líneas en el `<head>`. Parche, no cura, pero barato.
3. **El cold start de `/en`** (23 s de TTFB en un 307) — medición aparte, no compite.
4. **77 KiB de CSS sin usar** — `globals.css` es el ÚNICO CSS del app, crece monolítico por
   diseño. No urgente.



> Reordenado el 2026-08-06 **después** de medir. La versión anterior de esta tabla ponía
> Leaders primero como defecto y no incluía performance — las dos cosas cambiaron.

| # | Frente | Estado | Esfuerzo | Por qué ahí |
|---|---|---|---|---|
| — | **Leaders contradictorio** (§2) | ✅ **CERRADO** | — | La captura estaba vencida. Prod devuelve datos coherentes (471 esta semana / 487 histórico) y las capturas nuevas del founder lo confirman. No hay trabajo. |
| **1** | **Diferir las dos ramas de wallet** (§5) | 🔴 Abierto | Spec + tests + build | 2,2 MB de JS de wallet en el **root layout**, o sea en TODA ruta. Un jugador de MiniPay paga entera la rama de Privy que nunca ejecuta. Es la causa medida del 85→45 y de los segundos que se sienten al entrar al hub. **Manda sobre todo lo demás**: un hub lento hace irrelevante cualquier discusión de copy. |
| 2 | `preconnect` a los tres orígenes (§5) | 🔴 Abierto | Dos líneas | 300 ms cada uno. Parche, no cura, pero es el único ítem de la lista que cuesta minutos. |
| 3 | **"Come Back Tomorrow"** (§1) | 🔴 Abierto | Spec chico + build | Toca al jugador **del día 1** y apaga el ritual. Ya existe la anatomía validada (el banner del pass) para copiar. |
| 4 | Daily de PLAY (§3) | 🔴 Abierto | Depende del acople | Barato **si** el overlay de LEARN se puede reusar. Si hay que extraerlo, sube de tamaño y compite con el #5. |
| 5 | Umbral a los lúdicos (§4) | 🔴 Abierto | **Spec propio** | Mayor upside de retención, pero es pantalla nueva. No debería bloquear a los de arriba. |
| — | Cold start de `/en` (§5) | 🟡 Anotado | Medición aparte | 23 s de TTFB en un 307, con dos muestras. No compite con el trabajo de JS. |
| — | 77 KiB de CSS sin usar (§5) | 🟡 Anotado | — | `globals.css` es el ÚNICO CSS del app; crece monolítico por diseño. No urgente. |

## Preguntas abiertas

- **¿Se puede apagar Privy en MiniPay?** En MiniPay la wallet viene inyectada, así que la
  rama web no aporta nada ahí. Diferir el import lo resuelve **sin** tocar la flag — pero si
  además Privy no hiciera falta en alguna de las dos superficies, el ahorro sería mayor.
  ⛔ Hoy está **encendido en producción en los dos proyectos**, así que esto es una pregunta
  de producto, no un dato pendiente.
- ¿Hay más "status vestido de botón" además de `tomorrow`/`complete`? El founder sospecha
  que sí. Vale una barrida por todo estado terminal antes de escribir el spec del #3.
- El umbral del #5, ¿es una pantalla por pieza (seis) o una plantilla parametrizada? Cambia
  el costo por un factor de seis.
- ⚠️ **PLAY no consume el overlay de celebración de LEARN — falta saber por qué.** Si está
  acoplado a LEARN, el #4 deja de ser "portar" y pasa a ser "extraer".

## Qué NO quedó pendiente (para no re-auditarlo)

- **Las imágenes.** El pipeline AVIF/WebP de `ThemeAssetPicture` funciona: un browser real
  baja 16 KB donde el PNG pesa 890. Los PNG gordos del repo son fallbacks.
- **El chunk compartido.** 89,1 kB, sano. El peso no está ahí.
- **El ranking semanal.** SQL, route y cliente leen la misma relación; prod es coherente.
