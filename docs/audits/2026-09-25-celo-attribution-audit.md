# Auditoría read-only: Celo Attribution Tags de Chesscito

**Fecha:** 2026-09-25
**Alcance:** revisión estática de código, tests existentes, historia Git y configuración versionada. No se modificó código de producto, no se ejecutaron transacciones y no se imprimió el attribution tag.

## 1. Executive summary

- Attribution sigue implementado: un helper central añade `dataSuffix` a los requests de viem/wagmi cuando la variable está configurada y tiene formato válido.
- En producción, las rutas principales de Get Peones legacy, PRO, Season Pass, NFT, shop y score pasan por ese helper; no pude comprobar el bundle ni las variables actuales de Vercel.
- Encontré un write path sin helper: los claims de badge desde `useBadgeSheetState`, usados por Arena y el hub LEARN.
- `peones_pack_50` puede seguir un canary deliberadamente sin tag; el registro dice que está apagado en Production y habilitado en Preview, pero no verifiqué la configuración actual de Vercel.
- El checkout local tiene `NEXT_PUBLIC_CELO_ATTRIBUTION_TAG` presente, pero no pasa el formato esperado; el helper en ese caso omite el tag y permite la transacción.
- El código entró el 21-ago-2026. Transacciones anteriores a ese despliegue no podían llevar este tag; es una explicación sólida para parte del historial manual.
- El testimonio versionado registra un Get Peones real con marcador y `MATCH`, pero el documento omite su hash. No hay un hash utilizable para reverificarlo aquí.
- No hay evidencia suficiente para concluir que el dashboard de MiniPay debería contar todas las transacciones manuales ni para explicar por sí solo el contador “1”.

## 2. Architecture map

```text
[UI]
 GetPeonesSheet / ProSheet / SeasonPass / Arena / Learn hub / Shop / Profile
       ↓
[Hooks]
 usePaymentRail / useProRail / useSeasonPassRail /
 useMintVictory / useShopSheetState / ExercisesScreen / ProfileSheet
       ↓
[rail o request builder]
 request con address + abi + functionName + args
       ↓
[attribution]
 withChesscitoAttribution(request)
   └─ getChesscitoAttributionSuffix()
      └─ NEXT_PUBLIC_CELO_ATTRIBUTION_TAG → toDataSuffix(...)
       ↓
[wagmi]
 writeContractAsync(request con dataSuffix)
       ↓
[wallet MiniPay u otra wallet]
       ↓
[calldata en Celo]
 viem añade el suffix al calldata canónico
```

**Excepción:** `usePaymentRail` forma el request canónico sin envolver cuando `intent` existe; ese es el canary de Get Peones y envía calldata sin suffix.

**Fuga actual:** `useBadgeSheetState` construye `baseRequest` y llama `writeBadgeAsync` directamente, tanto con `feeCurrency` como en el retry sin fee. Ninguna de las dos llamadas lleva `dataSuffix`.

## 3. Write-path matrix

`TAGGED` significa que el request alcanza el escritor con `dataSuffix` **si** la configuración del build es válida. La columna “Encontrado” indica la propagación visible en el código; los flujos canarios y el helper tienen condiciones que se detallan en el reporte.

| Flujo | Archivo / función | Tx generada | Attribution esperado | Attribution encontrado | Estado |
|---|---|---|---|---|---|
| Get Peones legacy, cualquier SKU cuando no se solicita canary | `lib/payments/use-payment-rail.ts` / `pay` | `ERC20.transfer(treasury, amount)` | Sí | Helper antes del writer; fee y retry conservan el campo | `TAGGED` |
| Get Peones canary, `peones_pack_50` | `lib/payments/use-payment-rail.ts` / `pay` | `ERC20.transfer(canaryTreasury, amount)` | Excluido explícitamente | El request usa `canonical` cuando hay `intent`; verificador exige calldata exacto | `UNTAGGED_INTENTIONAL` |
| PRO por rail directo | `lib/pro/use-pro-rail.ts` / `pay` | `ERC20.transfer` | Sí | Helper; ambos intentos de writer conservan suffix | `TAGGED` |
| PRO legacy vía Shop | `lib/shop/use-shop-sheet-state.ts` / selección de producto | Ninguna por esta ruta: PRO se redirige al `ProSheet` | Sí, si algún caller volviera a usar el flujo | La ruta activa redirige; el rail directo tiene helper | `CONDITIONAL` |
| Season Pass | `lib/season-pass/use-season-pass-rail.ts` / `pay` | `ERC20.transfer` | Sí | Helper; retry conserva suffix | `CONDITIONAL` |
| Victory NFT, rama con permit | `lib/coach/use-mint-victory.ts` / `start` | `mintSignedWithPermit` | Sí | Writer envuelto; helper se aplica al request final | `TAGGED` |
| Victory NFT, rama sin permit | `lib/coach/use-mint-victory.ts` / `start` | `approve` y `mintSigned` | Sí | Writer envuelto para ambos writes | `TAGGED` |
| Badge claim desde Exercises | `components/exercises/exercises-screen.tsx` / claim handler | `claimBadgeSigned` | Sí | Helper dentro de `writeWithOptionalFeeCurrency` | `TAGGED` |
| Badge claim desde Arena / hub LEARN | `lib/badges/use-badge-sheet-state.ts` / `handleClaim` | `claimBadgeSigned` | Sí | **No**: `baseRequest` va directo a `writeBadgeAsync`, también en retry | `UNTAGGED_BUG` |
| Score submit desde Exercises | `components/exercises/exercises-screen.tsx` / save handler | `submitScoreSigned` | Sí | Helper dentro del writer compartido | `TAGGED` |
| Score submit diferido desde Profile | `components/profile/profile-sheet.tsx` / processor de claims | `submitScoreSigned` | Sí | Helper antes de fee y retry | `TAGGED` |
| Shop Founder Badge | `lib/shop/use-shop-sheet-state.ts` / `handleConfirmPurchase` | `approve` si hace falta; luego `buyItem` | Sí | Wrapper aplica el helper por request; fee y retry lo conservan | `TAGGED` |
| Otras llamadas de Shop visibles en Exercises | `components/exercises/exercises-screen.tsx` / compra | `approve` si hace falta; luego `buyItem` | Sí | Helper común de fee/retry | `TAGGED` |
| Badge claim diferido desde Profile | `components/profile/profile-sheet.tsx` / processor de claims | `claimBadgeSigned` | Sí | Helper antes de fee y retry | `TAGGED` |
| Development probes | `app/dev/**` | Varias | No aplica a producción | Fuera del inventario de producción | `UNKNOWN` |

**Alcance:** busqué todos los `writeContractAsync`, `writeContract`, `sendTransaction*` y `encodeFunctionData` bajo `apps/web/src`, excluyendo tests y rutas dev. No encontré un wrapper de producción que serialice manualmente un request etiquetado y pierda el campo. Los builders `transfer-builder.ts` producen datos económicos y no reciben attribution; el suffix se aplica después, al request de wagmi, como corresponde.

El test de attribution enumera siete archivos, pero **no** incluye `lib/badges/use-badge-sheet-state.ts`. Esa omisión explica por qué el test textual no detecta el flujo nuevo para la auditoría.

## 4. Hallazgos

### P1 — Un flujo de producción de badges no propaga attribution

`useBadgeSheetState` es llamado desde Arena y LearnHub. En ambos caminos, `handleClaim` invoca `writeBadgeAsync(feeManaged)` o `writeBadgeAsync(baseRequest)` sin el helper. La función de claim genera la transacción en ambos casos, así que el campo realmente falta, no sólo la importación.

`git blame` sitúa ese writer en el refactor de `useBadgeSheetState` del 7-may-2026, antes del commit de attribution. No parece una regresión posterior que haya borrado el suffix; parece un path existente que el inventario de agosto dejó fuera.

### P2 — Configuración con degradación silenciosa

En `apps/web/src/lib/payments/attribution.ts`, variable ausente, vacía o no aceptada por `toDataSuffix` produce `undefined`; `withChesscitoAttribution` devuelve el request intacto. En `NODE_ENV=production` sólo se registra un warning sin el valor.

El helper puede devolver `undefined`; no devuelve `0x` ni un string vacío como suffix. `apps/web/.env.template` deja la variable vacía. La lectura local segura (sin revelar el valor) indica `configured: yes`, `format-valid: no` en `.env.local`; esto demuestra sólo la configuración de ese archivo. No prueba el entorno ni el bundle de producción.

### P2 — Configuración pública se fija en build

El template documenta que `NEXT_PUBLIC_*` se inlinea durante el build. Sí, es posible que el entorno de Vercel esté correcto ahora y el deployment activo conserve un bundle construido sin tag. También puede haber Preview y Production con valores distintos. No hay un `vercel.json`, workflow o config versionada que fije esta variable; no inspeccioné el dashboard ni deployment metadata, así que disponibilidad al build en producción es `unknown`.

### P3 — Cobertura de tests parcial

No hay una prueba que demuestre que el request **que recibe un mock del writer** de cada ruta de producción contiene el suffix. AT-6 sólo busca el nombre del helper en siete archivos y fija la excepción canary. Por eso no detecta `useBadgeSheetState`.

No ejecuté tests: el checkout no tiene `node_modules` y `vitest` no está disponible. Tampoco ejecuté typecheck. El documento de implementación del 21-ago registra que entonces pasó una suite de 35 tests de attribution y la suite completa, pero eso no valida los writers incorporados o reestructurados después.

## 5. Historia y hashes

- Commit de introducción: `4029339d`, 21-ago-2026. Añadió helper, script, tests y wiring en siete archivos. El log describe explícitamente la exclusión del canary.
- Antes: pagos Get Peones por `usePaymentRail` se introdujeron el 9-jun y el rail canary el 30-jun; el tag aún no existía. Una transacción manual anterior a la publicación del cambio no podía llevar este tag.
- Después: no encontré un commit posterior que quite `dataSuffix` de PRO, Season Pass, Get Peones legacy, `useMintVictory`, Shop, Exercises o Profile. Sí encontré el writer de badge separado que el inventario dejó fuera.
- El documento de implementación registra una transacción real de Get Peones el 21-ago-2026: `transfer`, $0.05, suffix presente y `MATCH`. El hash fue omitido del documento. No encontré otro hash verificable vinculado a esa comprobación.
- Los hashes que sí aparecen en otros documentos corresponden a operaciones y fechas ajenas a esa comprobación o anteriores a la introducción. No hice RPC: el verificador requiere dependencias ausentes y una transacción histórica identificable por hash. Por tanto, no puedo reportar block, `to`, selector ni marker para un hash concreto.

## 6. Get Peones legacy vs canary

1. **¿Existe todavía?** Sí. Está cableado en `usePaymentRail`, sus verificadores y endpoints de intents.
2. **¿Puede terminar ahí un usuario normal?** Sí, en un deployment donde el flag público esté activo, al comprar `peones_pack_50`.
3. **¿Con qué condición?** `NEXT_PUBLIC_GET_PEONES_TREASURY_CANARY_ENABLED === "true"` al build y SKU elegible; además necesita pasar la creación de intent y validaciones del servidor.
4. **¿Qué porcentaje o usuarios podrían caer allí?** Es determinista: potencialmente todos los compradores de ese SKU en ese deployment; el código no contiene muestreo ni porcentaje. Los demás SKU no son elegibles. Producción figura como flag unset en la decisión documentada; Preview figura con flag activo. Estado actual de Vercel no comprobado.
5. **¿Deliberadamente sin tag?** Sí. `verifyCanaryTransaction` compara el input contra el calldata canónico con igualdad estricta. Añadir suffix podría hacer que el usuario pagara y que el servidor rechazara acreditar el pago.
6. **¿Sigue siendo necesario?** La ruta y su verificador siguen existiendo. La necesidad operativa del rollout no puede resolverse sólo leyendo el cliente; los documentos indican que sigue siendo un canary.
7. **¿Explica muchas menos tx atribuidas?** Puede explicar la falta de las compras `peones_pack_50` que realmente hayan ido por canary. No explica otras compras ni otros writes, y los registros dicen que ese flag estaba apagado en Production. No basta para explicar “sólo 1” sin confirmar despliegue y hashes.

## 7. Production configuration

| Fuente | configured | format-valid | available-at-build |
|---|---:|---:|---:|
| `apps/web/.env.template` | no | no | no; está vacío por diseño |
| `apps/web/.env.local` | sí | no | no válido según lectura local; el helper omitiría el suffix |
| Vercel Production actual | unknown | unknown | unknown |
| Vercel Preview actual | unknown | unknown | unknown |

El repo documenta Preview con canary habilitado y Production con el flag público sin setear, con decisiones fechadas el 1-jul. Eso es evidencia histórica, no lectura del entorno actual. Build-time inlining sí hace posible un deployment obsoleto aunque el panel tenga hoy el valor correcto.

## 8. Discrepancia de “1 transaction”

| Hipótesis | Evidencia a favor | Evidencia en contra / límite | Cómo confirmarla |
|---|---|---|---|
| Transacciones manuales anteriores al tag no cuentan | El commit se introdujo el 21-ago; antes no había helper | No sabemos las fechas exactas de las transacciones manuales | Recuperar hashes/fechas y verificarlos |
| Alguna operación usó el canary `peones_pack_50` | El rail omite el suffix intencionalmente; hubo uso real en Preview | Producción figura históricamente con el flag apagado; no sabemos la config actual | Revisar deployment env/build y confirmar SKU + deployment de la compra |
| Build de producción salió sin tag válido | El helper falla abierto y `NEXT_PUBLIC_*` se fija al build; configuración local observada es inválida | Local no refleja Production; testimonio de agosto verifica un deployment real | Verificar una tx nueva por flujo y comparar el build/deployment asociado |
| Badge claims desde Arena/LEARN salen sin tag | Writer actual omite el helper en ambos intentos | Afecta sólo claims por esa superficie, no explica pagos manuales no atribuibles | Crear un hash de badge claim y revisar calldata |
| Dashboard MiniPay filtra por wallet/red/superficie | Posible, pero el repo no aporta evidencia sobre el contador externo | Sin query o definición del dashboard no se puede evaluar | Comparar hashes y criterio/filtro que alimenta el contador |
| Otros rails nuevos perdieron suffix | Revisé rail directo PRO, Season Pass, Shop, NFT, Exercises y Profile; siguen usando helper | El flujo de badges sí quedó fuera del inventario | Revisar requests reales de cada rail en tx nueva |

## 9. Tests existentes y verificación

El script `pnpm -C apps/web attribution:verify <hash>` usa `verifyTx` para inspeccionar una transacción en Celo. Reporta si hay marcador, `schemaId`, cuántos códigos lleva y si uno coincide con el tag configurado en el proceso que ejecuta el script. No imprime el tag.

Valida marker y coincidencia del código configurado. Por sí solo no demuestra que la transacción venga de Chesscito, no identifica el flujo, no valida `to` ni selector, y no prueba que la wallet recibiera correctamente el request. La inspección debe combinarse con hash, destino, selector y contexto del flujo.

Los tests existentes cubren la codificación del helper con códigos fake, configuración ausente/malformada, semántica de suffix sobre calldata ERC-20, presencia textual de helper en siete archivos, excepción del canary y algunos invariantes económicos. Eso es más que un unit test superficial, pero no constituye una prueba de integración del request final en todos los writers. No ejecuté tests porque no hay `node_modules` en este checkout (`vitest: command not found`).

## 10. Verification plan

No ejecuté transacciones. Para aislar la propagación por flujo, usar builds donde el tag se valide antes de publicar; guardar cada hash y verificarlo con `pnpm -C apps/web attribution:verify <hash>` desde un entorno con dependencias y la configuración correcta.

| Acción | Coste configurado aproximado | Resultado esperado |
|---|---:|---|
| Get Peones legacy, SKU de 5 Peones | $0.05 más gas | `FOUND` + `MATCH` |
| PRO directo | $1.99 más gas | `FOUND` + `MATCH` |
| Season Pass Lite, si se reactiva la venta | $0.99 más gas | `FOUND` + `MATCH` |
| Badge claim desde Arena/LEARN | sin pago de producto; gas | Actualmente se espera `NOT FOUND`, confirma el bug |
| Un write de score o Shop Founder Badge, como rail representativo | score sin precio; Shop según catálogo y allowance | `FOUND` + `MATCH` |
| Canary `peones_pack_50`, sólo en Preview/entorno aprobado | $0.50 más gas | `NOT FOUND`, esperado por la igualdad canónica |

El verificador confirma marcador, schema y si algún código decodificado coincide con la configuración **del proceso que lo ejecuta**. No identifica el flujo, valida `to`/selector o demuestra que el hash venga de Chesscito. Esas comprobaciones requieren inspeccionar además la transacción y comparar el destino/selector con el flujo esperado.

## 11. Proposed fixes

1. Envolver el writer de `useBadgeSheetState` en `withChesscitoAttribution`, arriba del `try`, para que también el retry preserve `dataSuffix`.
2. Ampliar AT-6 para incluir `lib/badges/use-badge-sheet-state.ts`, y sustituir o complementar el chequeo textual con tests de request final recibido por el writer.
3. Añadir una comprobación previa al despliegue que reporte sólo `configured`, `format-valid` y presencia al build; nunca el valor.
4. Mantener el canary sin tag hasta que el verificador acepte con seguridad un prefijo canónico y esa frontera de pagos sea revisada.
5. Recuperar el hash de la verificación del 21-ago desde el operador/handoff original y volver a correr el verificador antes de sacar conclusiones sobre transacciones específicas.
