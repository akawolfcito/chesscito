# Verificación on-chain de Celo Attribution Tags

**Fecha:** 2026-09-25\
**Alcance:** diagnóstico del verificador, instalación congelada de dependencias, inspección de variables Production sin revelar valores y lectura RPC de dos transacciones de Celo. No se modificó código de producto, no se enviaron transacciones ni se imprimieron el attribution tag o los códigos on-chain.

## Resultado

| Hash | Flujo probable | Tx válida | Marker | Tag match | Resultado |
|---|---|---:|---|---|---|
| `0xc01e04fe4ae7ad7924f30c12800299cb1e41a5dbbb62eb7c9e81c98da8b4f669` | USDC `transfer`, compra probable de 5 Peones por $0.05 | Sí | NOT FOUND | No comparable | No lleva attribution |
| `0xf3747c2d9f5ae562cafa45a4c396ddba3c10487e3c047e6726aafcdcd08fc2f2` | `mintSignedWithPermit` de Victory NFT | Sí | NOT FOUND | No comparable | No lleva attribution |

## Evidencia on-chain

| Campo | Compra de Peones | Victory NFT |
|---|---|---|
| Estado | success | success |
| Bloque | 78413641 | 78413698 |
| Timestamp UTC | 2026-09-25 05:33:19 | 2026-09-25 05:34:16 |
| `to` | `0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e` (USDC Celo) | `0x0ee22f830a99e7a67079018670711c0f94abeeb0` |
| Selector | `0xa9059cbb` (`transfer(address,uint256)`) | `0xb31e32cc` (`mintSignedWithPermit(...)`) |
| Longitud input | 68 bytes | 484 bytes |
| Suffix ERC-8021 | Ausente | Ausente |

La transferencia decodifica a un destinatario que coincide con el treasury configurado en Production y un importe de `50000` unidades de USDC (6 decimales), es decir, $0.05. El rail define $0.01 por Peón, así que el valor es consistente con cinco Peones.

El selector del NFT se comparó contra el ABI local de `VictoryNFTUpgradeable`; coincide exactamente con `mintSignedWithPermit`. El destino coincide con `NEXT_PUBLIC_VICTORY_NFT_ADDRESS` de Production. No es la rama `approve` + `mintSigned`.

## Diagnóstico local

**Root cause:** no existía `node_modules` ni en la raíz ni en `apps/web`; por eso no existía el ejecutable `tsx` aunque está declarado en `apps/web/package.json`. Es un monorepo pnpm con `pnpm@8.10.0`, workspace `apps/*` y lockfile versionado.

**Correct install command:** `pnpm install --frozen-lockfile` desde la raíz del monorepo.

**Why:** pnpm instala el workspace y enlaza `tsx` a `apps/web`; el lockfile se encontraba al día. `tsx`, `viem`, `wagmi` y `@celo/attribution-tags` quedaron disponibles en el workspace después de instalar.

**Risk:** instala las dependencias ya fijadas para los seis proyectos del workspace y ejecuta los lifecycle scripts definidos por esas dependencias. No actualizó el lockfile ni cambió manifests. No se ejecutaron tests ni autofix.

Después de instalar, el script arrancó dentro del sandbox, pero `tsx` no pudo crear su socket IPC por una restricción `EPERM`; las consultas se completaron fuera del sandbox con autorización, mediante RPC read-only.

## Configuración y despliegue

| Entorno | Configurado | Formato válido | Nota |
|---|---:|---:|---|
| Variable heredada por el shell local | No | No aplica | El proceso de shell no la tenía exportada |
| `apps/web/.env.local` | Sí | No | Valor local de 13 caracteres, no hexadecimal; nunca se imprimió |
| Vercel Production | Sí | Sí | El CLI reportó la variable creada hace aproximadamente 22 minutos y `toDataSuffix` aceptó su formato |

La variable Production se inyectó en memoria mediante `vercel env run`. Con ese entorno, el verificador reportó `Attribution marker: NOT FOUND` para los dos hashes. Como no existe suffix, no hay `schemaId` ni lista/cantidad de códigos que comparar; el resultado de tag es **no comparable** y el marcador ausente ya prueba que la transacción no contiene el tag configurado.

Al consultar Vercel, los dos deployments Production más recientes de Chesscito figuraban `Canceled`; el último Production `Ready` listado tenía 8 días. Los hashes se minaron después de los intentos cancelados. Esto confirma que Vercel tiene el valor configurado, pero no confirma un redeploy Production exitoso que lo haya incorporado al frontend. La explicación más probable está en la capa build/deployment activo: el nuevo valor no quedó en un bundle servido por un deployment Production `Ready` antes de estas transacciones. La evidencia on-chain confirma el resultado final, pero no permite por sí sola distinguir si además hubo una pérdida posterior en frontend, wrapper, request o wallet.

## Conclusiones

1. **¿Funcionó el redeploy con la variable?** No hay evidencia de un redeploy Production exitoso; Vercel muestra los intentos recientes cancelados.
2. **¿La compra de Peones lleva attribution?** No. `transfer` exitoso, importe consistente con $0.05, sin marker.
3. **¿El claim NFT lleva attribution?** No. `mintSignedWithPermit` exitoso, sin marker.
4. **¿Ambas usan el mismo tag?** No se puede hablar de tags distintos o iguales porque ninguna lleva un attribution code. Ambas carecen del marker.
5. **¿El problema anterior era simplemente ausencia de la env en Vercel?** No para esta pareja: la variable ya estaba configurada en Production antes de minarse ambos hashes. La evidencia apunta a que el deployment activo no incorporó esa configuración.
6. **¿Queda un problema local?** Las dependencias ya quedaron instaladas y `tsx` arranca. La configuración de `.env.local` sigue teniendo formato inválido; para Production, `vercel env run` confirmó formato válido y el script se ejecutó, pero informó correctamente ausencia de marker.

## Revisión posterior al nuevo deployment

**Hora de consulta:** 2026-09-25 06:07 UTC. Vercel listó `chesscito-8ur5s995o-goodwolf.vercel.app` como Production `Ready`, con antigüedad aproximada de 15 minutos. La variable de attribution continúa configurada en Production. Ambas transacciones ocurrieron después de ese deployment.

| Hash | Estado / bloque / UTC | `to` / selector / input | Flujo y checks | Resultado attribution |
|---|---|---|---|---|
| `0x44c6c48ca6143b4ca19ba86494be3f51eee19e6b8f2da4e158e2cff37234e322` | success / 78415176 / 05:58:54 | USDC / `0xa9059cbb` / 99 bytes | `transfer`, 50,000 unidades USDC ($0.05); recipient coincide con treasury Production | FOUND, schema 0, 1 código, MATCH |
| `0xda67d3650b8b848d584880e143bb03662d3cbed9ac3a4c683810bc1cad31cfb3` | success / 78415448 / 06:03:26 | Victory NFT / `0xb31e32cc` / 515 bytes | `mintSignedWithPermit`; destino coincide con Victory NFT Production | FOUND, schema 0, 1 código, MATCH |

En ambos casos el input supera en 31 bytes la longitud del calldata canónico (68→99 y 484→515), consistente con el suffix detectado por el verificador. El script recibió el entorno Production mediante `vercel env run`; no se imprimió el tag ni el código transportado.

Esta pareja sí aporta evidencia on-chain de que el flujo está funcionando después del nuevo Production `Ready`: tanto la compra de Peones como el claim NFT llevan un marker cuyo código coincide con el tag configurado en Production.
