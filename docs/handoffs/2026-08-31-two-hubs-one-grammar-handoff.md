# Los dos hubs con una gramática · handoff

**Fecha:** 2026-08-31 · **Rama:** `main` local · **83 commits sin pushear al cierre**
⚠️ **Medilo vos:** `git rev-list --count origin/main..main`. Envejece con cada commit,
incluido el de este handoff.

**Specs:** `docs/specs/2026-08-30-play-hub-revision-ux-spec.md` ·
`docs/specs/2026-08-30-learn-hub-revision-ux-spec.md`
**Sesión previa:** `docs/handoffs/2026-08-30-play-hub-revision-handoff.md`

---

## 0. ⛔ LO MÁS IMPORTANTE, y lo que más fácil se pierde entre 83 commits

**La pausa del Season Pass nunca había llegado a producción.** La venta siguió viva
desde el 2026-08-25 hasta este deploy.

`feature-flags.ts` en `origin/main` **no tenía** `NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED`,
y `season-pass-sheet.tsx` en producción tenía **cero** referencias al guard. Toda la
mecánica —el flag, el guard de la hoja, el del mini-tour, el del carrusel del landing—
viajaba sin desplegar.

> **Este deploy es el que apaga la venta, seis días después de lo que se creía.**

⚠️ Y eso reordena un episodio de la sesión: se "encontró" que PLAY vendía un producto
pausado y se revirtió al ver que PRO ≠ Season Pass. La verdad de fondo era otra:
**nada estaba pausado**, porque la pausa misma estaba sin desplegar.

---

## 1. Estado del deploy

| | |
| --- | --- |
| Migración `inbox_v0` | ✅ **Aplicada y registrada** (`db push --dry-run` → "up to date") |
| Env vars a configurar | **Ninguna.** `NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED` es opt-in: su ausencia pausa |
| Tests | 728 archivos / **9.235 passed** · typecheck limpio |
| VR | **68/68 con `--update-snapshots=none`**, 82 baselines antes y después |
| Nada sensible en el rango | verificado: 0 archivos de `private/`, 0 secretos |

**Higiene pendiente, sin apuro:** `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT` sigue en
**50**. Ponerlo en **0** — su código ya no existe. Sólo donde `apps/web` corre en LEARN;
el landing no la lee.

---

## 2. Qué cambió

**Los dos hubs quedan con la misma gramática:** header en dos zonas · marca · toggle ·
mundo · UN CTA primario morado · rail de destinos.

### PLAY
- Panel Kingdom **fuera** — era el placeholder de texto que sobrevivió al render que lo
  volvía innecesario. Borrarlo **completa** la spec de 2026-05-03, no la contradice.
- Mini-tour **fuera**. Rail: `Duel · Warm-up · Coach · Shop` → **`Coach · Shop`** (+ PRO
  sólo para suscriptor activo, como estado y no como oferta).
- DUEL a la zona del pulgar y compacto: 334px → **268px**, radio 999 → 22.
- Header: trofeo fuera, `EN ⌄`, iconos a 36px con área táctil intacta en 44×44.

### LEARN
- `Start Focus` **fuera**: llamaba al MISMO resolver que el tile de Exercises. Era el
  DUEL duplicado otra vez. Y era el último CTA verde, que el contrato reserva al mundo.
- Focus Passport **compactado 167px → 109px**. ⚠️ **NO se borró**: a diferencia del panel
  de PLAY, es un **registro** — las siete llamas son la única evidencia visible de que
  alguien volvió, y 434 de 443 wallets jugaron un solo día.
- `EXERCISES` promovido a CTA primario morado. Rail → **`PROVING GROUNDS` / `CAMPO DE
  PRUEBAS`**.
- Mini-tour **fuera**, y con él su experimento (ver §4).

### Inbox
- Fondo del mundo en vez de la hoja crema.
- ⚠️ Al hacerlo, poner el color claro en la RAÍZ dejó **todos los títulos en blanco sobre
  blanco**. Los 9.235 tests seguían verdes: el DOM era perfecto. **Se agarró
  renderizando.** Arreglado en las dos puntas: el cromo declara su color y la tarjeta el
  suyo, ninguno hereda del otro.

---

## 3. Cinco errores míos, y su causa común

Cuatro de cinco salieron de lo mismo: **medir un fixture que no coincidía con producción.**

| # | Qué afirmé | Qué era |
| --- | --- | --- |
| 1 | El mini-tour tenía 2,9× de lift | **Selección, no causalidad.** "Nunca lo vio" eran 169 de 6.177 — gente que se fue antes de que se dibujara |
| 2 | Había un vacío de 200–350px en PLAY | Artefacto del fixture: fondo plano donde producción tiene bosque |
| 3 | El `+` de Peones era un botón dentro de un contador | Es `aria-hidden`; la píldora entera es el control |
| 4 | ⛔ **P0: PLAY vendía el pase pausado** | **PRO ≠ Season Pass.** `PRO_PACKS` vs `SEASON_PASSES`. Apagué un producto vivo |
| 5 | El panel de LEARN medía 266px con 78px de hueco | Medí `variant=active`; producción renderiza modo hábito. Real: **167px, sin hueco** |

⛔ **El peor no fue equivocarme, fue el proceso del #4:** escribí *"no tracé el SKU
exacto"* en la propuesta **y lo mandé igual, rotulado P0**. Una incertidumbre declarada no
es una incertidumbre resuelta.

⛔ **Y escribí tres tests que fijaban esa creencia falsa**, lo que hizo que el error
pareciera verificado. Un test pinea algo equivocado con la misma firmeza que algo correcto.

---

## 4. Decisiones de producto tomadas

| Decisión | Fundamento |
| --- | --- |
| **PRO sigue vivo y vendible** | Lo pausado es el Season Pass de 21 días — 21 resultó demasiado largo para convertir. Vuelve como 3/5/7 días |
| **Peones como palanca principal** | La vía más práctica para dinámicas simples y cobrables |
| **`PROVING GROUNDS`** | `MINI-GAMES` describe el formato; `THE GAUNTLET` muere en español; `CHALLENGES` tiene la palabra **triplemente ocupada** (incluido `Pivot Challenge`, un item del mismo rail) |
| **Los CTA de ambos hubs en morado** | El modo ya se diferencia 3 veces (toggle, label, ícono). El hub es 26,9% dorado y 32,9% azul: no hay contraste disponible |
| **Avatares de distinto tamaño** | LEARN carga 83px más de contenido. Igualarlos rompería su composición |

### El experimento de primera actividad, retirado

Estaba **vivo al 50%**. Su hipótesis era *"quien termina el tour y aterriza en una grilla
de opciones se va sin hacer nada"*. **Esa grilla ya no existe** — el control también
aterriza en un CTA morado. **El tratamiento se convirtió en el control.**

⚠️ Nadie queda varado: el tour se mostraba una vez por instalación. Esto **corta el
reclutamiento, no revoca a nadie**. Lo ya recolectado sirve; lo posterior mezclaría dos
poblaciones con controles distintos.

---

## 5. Lo que sigue

1. **Push** → deploy. Mirar: el pase ya no se ofrece · el ✉️ y el fondo del Inbox ·
   `chesscito.com/pricing` (el push despliega **dos** proyectos Vercel).
2. **Mandar el mensaje** de "10 Focus Days". JSON listo en `private/inbox/` (EN y ES),
   con las tres reglas del spec cumplidas: sin "racha", sin monto, sin CTA. **Usar
   `--dry-run` primero.** ⚠️ Existe además `private/2026-08-25-focus-message.json`,
   preparado el día del spec — **compararlos antes de mandar**, puede ser un duplicado.
3. `NEXT_PUBLIC_ONBOARDING_FIRST_ACTIVITY_PCT` → 0.
4. **Instrumentar el abandono** (`arena_game_abandoned`, `reached_board`): sigue siendo lo
   más barato y lo único que vuelve medible la fuga más grande. Las 1.752 personas que
   empiezan y no terminan siguen siendo invisibles.

### Deudas abiertas

| # | Qué |
| --- | --- |
| 1 | ⛔ **No existe canal global.** El tipo `announcement` está en el modelo pero el script escribe UNA fila por wallet y la API SIEMPRE filtra por wallet. Anuncios, features y stickers **no tienen cómo enviarse**. Dos caminos: fan-out (N filas) o broadcast (`wallet = null` + mezcla en la consulta) — recomendado el segundo |
| 2 | `first-activity-experiment.ts` quedó **sin llamador**. Sus tests puros pasan. Retirarlo en su propia pasada |
| 3 | `PrimaryPlayCta` sigue verde en 6 consumidores (deuda 1 histórica) |
| 4 | El Inbox guarda **un solo cuerpo, sin locale**: quien reciba el mensaje lo lee en el idioma elegido aunque tenga la app en el otro |

---

## 6. ⛔ Trampas confirmadas esta sesión

- **Un dev server ajeno en el 3002 contamina el VR**, y el síntoma no siempre es el banner
  ámbar: una vez fue **la pantalla de acceso entera** tragándose cada página. ⚠️ El puerto
  estaba libre al empezar y el proceso apareció después — **chequealo justo antes de la
  corrida que vas a usar para regrabar**, no una vez al principio.
- **`CREATE POLICY` no acepta `IF NOT EXISTS` en Postgres.** La migración del Inbox falló
  con 42710 contra una base donde los objetos existían pero el registro no. ⛔ Se arregla
  con idempotencia, **nunca con `migration repair`**: eso deja un archivo que igual explota
  en cualquier base nueva.
- **Backticks en `git commit -m` se los come zsh.** Pasó otra vez: un mensaje quedó
  diciendo *"NO con ."*. Usar `-F` con archivo.
- **Borrar un elemento no reduce el vacío**: se lo entrega a quien absorbe el sobrante.
  En PLAY, sacar el panel sin mover el CTA habría llevado el hueco de 171px a ~387px.

⚠️ **Atribución:** 83 commits caen en la misma ventana, sin A/B. Rediseño de los dos hubs,
replay instantáneo, sistema de color, Inbox, pausa del pase y `/pricing`. **Si el retorno
se mueve, no se va a saber cuál lo movió.**
