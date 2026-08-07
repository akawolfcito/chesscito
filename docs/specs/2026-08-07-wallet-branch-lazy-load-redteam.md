# Red Team Review — wallet-branch-lazy-load

**Spec**: `docs/specs/2026-08-07-wallet-branch-lazy-load.md`
**Reviewer mindset**: hostile QA + senior engineer

---

## Pase 2 — 2026-08-07 (post-experimentos y post-correcciones)

### Cerrados del pase 1

| # | Hallazgo | Cómo cerró |
|---|---|---|
| P0-1 | Marcadores tree-shakeables | ✅ Eliminados. C4 usa evidencia load-bearing (el literal del `throw` de `requirePrivyAppId`). **Parcial: falta el de injected.** |
| P0-2 | Premisa del guard sin verificar | ✅ **EXP1 la confirmó**: `"ShopSheet"` da 0 hits en la entrada PAGE. El manifest no enumera chunks diferidos. |
| P0-3 | Ahorro del hub posiblemente cero | ✅ **EXP2 lo midió y el spec lo dice sin maquillar**: el hub pierde la rama Privy y **retiene** wagmi/viem por claims. |
| P0-4 | E3 sin decidir | ✅ Decidido: error boundary + mensaje corto + "Retry". |
| P1-1 | Re-export de `wagmiConfig` | ✅ Eliminado. Se actualizan los dos importadores. |
| P1-3 | AC7 infalsificable | ✅ Reformulado a "monta exactamente una vez". |
| — | AC18 sin criterio de falla | ✅ Ahora exige `< 382 kB`, con AC22 de control. |

### P0 — Nuevos, introducidos por la revisión

- **[i18n] El copy del retry no existe en el bundle, y hay un guard que lo va a cachetear.**
  E3 mete **texto visible nuevo** ("mensaje corto + Retry") y el spec no dice **una palabra**
  de i18n. Este repo tiene un guard de traducción **sobre todo el bundle**, la UI es EN + ES
  vía next-intl, y un string suelto en JSX no pasa. Peor: si se agrega sólo a un lado, el
  bundle ES imprime el path crudo — el spread de nivel superior **no es un deep merge**.
  — **Por qué bloquea**: el spec pide implementar una pantalla que, tal como está escrita,
  **no puede pasar la suite**. Hay que nombrar las claves y las dos traducciones **en el
  spec**, no descubrirlo en el primer test rojo.

- **[retry] "onRetry" está escrito como si fuera trivial, y es la parte difícil.** Un
  `import()` que rechaza queda **cacheado como rechazado**: tanto webpack como `React.lazy`
  memorizan la promesa fallida, así que volver a llamar al mismo `import()` **devuelve el
  mismo rechazo sin tocar la red**. Un botón "Retry" que no reintenta nada es peor que no
  tenerlo: miente. El contrato `onRetry: () => void` no dice cómo se rompe ese caché
  (¿`key` que remonta? ¿factory nueva por intento? ¿contador en el estado?).
  — **Por qué bloquea**: es el mecanismo central del único estado nuevo que agrega el spec, y
  AC20 exige explícitamente que el retry funcione **más de una vez**. Sin decidirlo, AC20 se
  implementa mal y pasa igual.

- **[bloqueante declarado] La evidencia de la rama `injected` sigue sin existir, y el spec se
  contradice sobre cuándo resolverla.** C4 la marca ⛔ sin resolver; Open questions dice
  "es lo primero a resolver **en el TDD**". Pero la instrucción del founder fue resolverla
  **antes** de implementación. Sin ella **AC10 y AC12 no son implementables** — es decir, la
  mitad del guard, que es la mitad del valor del spec.
  — **Por qué bloquea**: no es un detalle de implementación, es un agujero en el contrato de
  verificación.

### P1 — Vivos del pase 1, sin atender en la revisión

- **[VR] El VR va a fotografiar el shell.** Con `ssr: false` el primer paint de toda ruta pasa
  a ser `WalletShell`. El spec sigue pidiendo (AC17) 62/62 sin `--update-snapshots` y **no
  dice qué cambios de baseline son aceptables**. Riesgo escrito en este repo: se re-baselinea
  un splash y se declara verde una app rota.
- **[wagmi] `ssr: true` + `ssr: false` sigue sin analizar.** `WalletProviderInner` autoconecta
  MiniPay en un `useEffect`; con la rama fuera del SSR esa autoconexión se corre un ciclo de
  red. Invisible en tests, visible en el device.
- **[guard] La detección de staleness sigue apoyada en fechas.** El spec todavía dice "más
  viejo que el último commit". `CLAUDE.md` ya tiene escrito que el `mtime` de un reporte no
  prueba que algo corrió. Falta el sello de contenido.
- **[test] El guard se sigue pudiendo colar en `pnpm test`.** `test = vitest run` sin filtro.
  Sin exclusión explícita, corre sin build y lee un `.next` viejo.
- **[alcance] `ProductContextProviders` y `ChainConfigWarning`** los importan las dos ramas;
  el spec sigue sin decir que el guard **no** debe tratarlos como exclusivos.

### P2

- AC15 sigue fijando "7404 passing" cuando AC2 reescribe tests y AC19–AC22 agregan otros.
- `test:bundle` sigue sin renombrarse a algo que diga qué falla cuando falla.
- E7 sigue sin umbral numérico para "asset pesado".
- C2b tipa `WalletBranchBoundary` con `children` pero no con el estado — `BranchLoadState` se
  declara y no se usa en ninguna firma.

---

## Lo que la revisión hizo bien

- **EXP2 está reportado sin maquillar**, incluida la parte incómoda: el hub retiene wagmi/viem
  y las rutas secundarias mejoran más. Eso es exactamente lo que el founder pidió y es lo que
  evita declarar victoria con el número de `/terms`.
- **La trampa de EXP1** (buscar nombres da falsos positivos: `"hub-tour"` aparece en la
  entrada PAGE aunque su chunk sea diferido) está documentada donde el implementador la va a
  leer. Ese hallazgo vale más que el experimento que lo produjo.
- Matar el re-export en vez de dejarlo "desaconsejado" cierra la puerta por diseño.

---

## Verdict pase 2

⛔ **NEEDS REVISION** — 3 P0, 5 P1, 4 P2.

Los tres P0 son **decisiones de spec**, todas baratas y ninguna requiere medir:

1. **Nombrar las claves i18n del retry y sus dos traducciones** (EN + ES) en el spec.
2. **Decidir cómo se rompe el caché del import rechazado** para que "Retry" reintente de
   verdad, y más de una vez.
3. **Elegir la evidencia load-bearing de la rama `injected`** — o aceptar explícitamente que
   el guard cubre sólo la dirección Privy y bajar AC10/AC12 de "criterio" a "futuro".

Con eso el spec queda listo para `/tdd`. Los P1 se atacan durante la implementación, **salvo
el del VR**: ése hay que decidirlo antes de correr el VR por primera vez, o la tentación de
re-baselinear va a ganar.

---

## Pase 3 — 2026-08-07 (post-decisiones del founder)

### Cerrados del pase 2

| # | Hallazgo | Cómo cerró |
|---|---|---|
| P0-5 | Copy del retry sin i18n | ✅ C2d: namespace `WALLET_LOAD_ERROR_COPY` con las tres claves y **las dos traducciones escritas en el spec**, bajo el guard, sin exenciones. AC24 lo verifica. |
| P0-6 | "Retry" decorativo sobre promesa cacheada | ✅ C2c veta explícitamente re-llamar al mismo `import()`, exige identidad de loader nueva y acepta `reload()` como salida honesta. **AC23 exige observar el intento nuevo**, no que el botón exista. |
| P0-7 | Evidencia injected inexistente | ✅ C4: `data-wallet-branch` renderizado por cada rama. Deja de ser una constante huérfana y pasa a ser comportamiento observable. |

**La corrección más fuerte de las tres es la de C4**, y no por el guard: al asertar AC6 sobre
`data-wallet-branch`, la evidencia de bundle y la de comportamiento **se vuelven la misma
cosa**. Borrar la firma ya no rompe sólo el guard — rompe tests de comportamiento. Eso es
justo lo que faltaba en el pase 1, donde el guard podía quedar verde por ausencia.

⚠️ **Una nota sobre la firma de Privy:** el spec degradó el literal del `throw` a respaldo y
promovió `data-wallet-branch="privy"` a firma primaria. Correcto: el mensaje de error es
**incidental al bundle** y un refactor de copy lo reescribiría sin que nadie notara que
rompió el guard.

### P0 — Ninguno

### P1 — Vivos, sin atender en esta revisión

Los cinco del pase 2 siguen abiertos y **ninguno bloquea empezar**:

- **[VR] El VR va a fotografiar el shell** (AC17 pide 62/62 sin `--update-snapshots` y el spec
  sigue sin decir qué cambios de baseline son aceptables). ⚠️ **Éste hay que decidirlo antes
  de la primera corrida del VR**, no antes del primer test.
- **[wagmi] `ssr: true` + `ssr: false`** — la autoconexión de MiniPay corre un ciclo de red.
- **[guard] Staleness por fecha** en vez de sello de contenido.
- **[test] El guard se puede colar en `pnpm test`** — falta exclusión explícita.
- **[alcance] `ProductContextProviders` / `ChainConfigWarning`** los importan las dos ramas;
  el guard no debe tratarlos como exclusivos.

### P2 — Nuevos

- **AC25 y AC6 se superponen.** AC6 dice "exactamente un provider" y AC25 dice "AC6 se asserta
  sobre `data-wallet-branch`". Es una restricción sobre otro AC, no un criterio propio.
  Funciona, pero un AC que gobierna a otro AC es una forma rara de escribirlo.
- **C2b ahora tipa `state: BranchLoadState`** — bien —, pero el spec no dice **quién** lo
  calcula: ¿el boundary por dentro, o el llamador? Con `React.lazy` + Suspense el estado vive
  repartido entre Suspense y el error boundary, y "pasarlo como prop" puede volverse mentira.
- Los cuatro P2 del pase 2 siguen (baseline 7404, nombre `test:bundle`, umbral de E7,
  `BranchLoadState` sin uso — este último ahora **sí** se usa).

---

## Verdict pase 3

✅ **READY for /tdd** — 0 P0, 5 P1, 6 P2.

Las tres decisiones del founder cerraron los tres P0 sin abrir ninguno. Los P1 son trabajo de
implementación, con **una excepción de calendario**: la política de baselines del VR hay que
fijarla antes de correr el VR, no antes del primer test rojo.

**Orden sugerido para el TDD**, del contrato hacia afuera:

1. `lib/wallet/wagmi-config.ts` + reapuntar los dos importadores (sin re-export).
2. `data-wallet-branch` en las dos ramas + AC6/AC25 en rojo → verde.
3. Boundary diferido + `WalletShell` (AC1–AC8), incluida la reescritura del test de SSR (E1).
4. E3 completo: estado terminal, retry con intento nuevo observable, i18n (AC19–AC24).
5. Guard de bundle (AC9–AC14) — **al final**, porque necesita el build de todo lo anterior.
6. Medición (AC18, AC22) y reporte honesto del hub.
