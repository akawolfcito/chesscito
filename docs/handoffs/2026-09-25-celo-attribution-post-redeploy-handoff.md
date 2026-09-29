# Handoff — Celo Attribution Tags verificados después del redeploy

Fecha: 2026-09-25

## Estado

La verificación on-chain posterior al nuevo deployment Production quedó cerrada para las dos transacciones indicadas por el usuario. **Ambas incluyen un marker ERC-8021 con schema 0 y un código; el código coincide con `NEXT_PUBLIC_CELO_ATTRIBUTION_TAG` de Production.** No se imprimió ni se guardó el valor del tag.

## Evidencia

| Flujo | Hash | Tx / calldata | Attribution |
|---|---|---|---|
| Compra Peones | `0x44c6c48ca6143b4ca19ba86494be3f51eee19e6b8f2da4e158e2cff37234e322` | success; bloque 78415176; 2026-09-25 05:58:54 UTC; USDC `transfer(address,uint256)`; input 99 bytes; $0.05; recipient coincide con treasury Production | FOUND; 1 código; MATCH |
| Victory NFT | `0xda67d3650b8b848d584880e143bb03662d3cbed9ac3a4c683810bc1cad31cfb3` | success; bloque 78415448; 2026-09-25 06:03:26 UTC; `mintSignedWithPermit`; input 515 bytes; `to` coincide con Victory NFT Production | FOUND; 1 código; MATCH |

En ambos inputs la longitud supera en 31 bytes la codificación canónica sin suffix (transfer: 68→99; mint: 484→515). El verificador se ejecutó con `vercel env run -e production --project chesscito --scope goodwolf`; devolvió FOUND, schema 0 y MATCH para ambos hashes.

Vercel listó `chesscito-8ur5s995o-goodwolf.vercel.app` como Production `Ready`, de aproximadamente 15 minutos de antigüedad al consultar a las 06:07 UTC. La variable de attribution estaba configurada en Production (creada aproximadamente 47 minutos antes). Ambas transacciones ocurrieron después del deployment listo.

## Contexto del intento anterior

Los dos hashes auditados antes del nuevo deploy (compra `0xc01e…f669`, NFT `0xf374…f2f2`) tuvieron estado success pero **NOT FOUND**. En esa consulta los deployments Production recientes aparecían cancelados y el último Ready era de ocho días. No mezclar esos resultados con los hashes posteriores, que sí tienen marker y MATCH.

## Estado local / seguridad

- El primer intento falló por ausencia de `node_modules`; se ejecutó `pnpm install --frozen-lockfile` desde la raíz. `tsx`, `viem`, `wagmi` y `@celo/attribution-tags` están instalados. El lockfile no cambió.
- `apps/web/.env.local` contiene una copia local del tag de formato inválido; no usarla para comparar. Para Production se inyectó el entorno en memoria con `vercel env run`.
- No se cambió código de producto, no se ejecutaron tests/autofix, no se hicieron commits/push ni transacciones.
- El reporte detallado está en [docs/audits/2026-09-25-celo-attribution-transaction-verification.md](../audits/2026-09-25-celo-attribution-transaction-verification.md).

## Continuación

No queda trabajo requerido para estos dos hashes. Si se verifican nuevas transacciones, ejecutar `pnpm -C apps/web attribution:verify <hash>` bajo `vercel env run -e production --project chesscito --scope goodwolf -- ...` y corroborar status/bloque/destino/selector por RPC read-only. Mantener el tag y códigos transportados fuera de logs y documentos.
