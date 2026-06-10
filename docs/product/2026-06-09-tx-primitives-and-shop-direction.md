# Dos primitivas de transacción + dirección del Shop

> 2026-06-09. Nota de entendimiento (no de acción) tras el smoke del rail de Peones
> y el 429 al guardar score en `/exercises`. Objetivo: aclarar qué pasa, cómo
> funciona y cuál es el paso lógico — sin tocar contratos todavía.

## TL;DR

Chesscito tiene **dos primitivas on-chain distintas**, no una. No se pueden fusionar
porque resuelven cosas diferentes:

| | **A. Record / Mint** | **B. Pago directo (rail)** |
|---|---|---|
| Ejemplos | Save score, Labyrinth badge, Victory NFT | Comprar Peones |
| Flujo | server firma EIP-712 → wallet manda tx a **nuestro contrato** → registro/NFT on-chain | wallet manda `ERC20.transfer(treasury)` → server verifica el receipt → **crédito off-chain** (ledger) |
| El valor ES | el artefacto on-chain (el score, el badge) | mover dinero; lo comprado vive off-chain |
| Endpoint server | `/api/sign-*` (firma) — **rate-limited** | `/api/verify-payment` (verifica, no firma) |
| Approve | no | no |
| Fricción | gas + firma server (puede dar **429**) + 1 tx | 1 tx, sin approve, sin firma previa |

El rail de Peones (B) se siente más elegante porque **elimina la firma server y el
approve**. Pero no puede reemplazar a A cuando el punto ES escribir en nuestro contrato.

## Por qué el 429 en save-score

`/api/sign-score` firma un `ScoreSubmission` (EIP-712, dominio `Scoreboard`,
`verifyingContract = scoreboardAddress`) y aplica `enforceRateLimit(ip, player)`.
Al reintentar el save varias veces seguidas se cruzó el límite → `429 Rate limit
exceeded` → el popup "Couldn't save / Try again / Dismiss" (ResultOverlay).
Es una **protección del endpoint de firma**, no un bug del código nuevo. El save
de score es primitiva **A**: una escritura on-chain al contrato `Scoreboard`.

## ¿El save puede adoptar el estilo del rail de Peones?

Parcialmente, y la respuesta correcta NO es "convertir el save en un transfer de
stablecoin" (no hay dinero que mover; el score no es un pago). La lección que SÍ
transfiere es de **fricción**: hoy cada save es una escritura on-chain con firma
rate-limited. El insight real:

- **Default off-chain.** Guardar el score puede ser un **registro off-chain**
  (igual que el ledger de Peones): rápido, sin firma, sin 429.
- **On-chain solo opt-in.** Reservar la escritura al contrato (mint) para cuando
  el usuario quiere el **coleccionable permanente** (Victory NFT / badge). Eso es
  primitiva A y ahí sí vale la firma + gas.

Eso quita la fricción del camino común sin perder la opción on-chain.

## Qué pasa con los contratos

Nada se borra ni se redeploya por esto. Cambia **qué camino usa cada acción**:

- **Scoreboard / LabyrinthBadges / Victory NFT** → siguen siendo primitiva A
  (signed-mint). Necesarios cuando el item ES on-chain.
- **Shop.sol (`buyItem`, approve + transferFrom)** → es la versión "pesada" de un
  pago con stablecoin. El rail (B) lo hace mejor (1 tx, sin approve, verify +
  ledger). Para SKUs pagados con stablecoin, **el rail reemplaza a `buyItem`**;
  `Shop.sol` queda legacy salvo que necesitáramos registro de compra on-chain
  (no lo necesitamos: el ledger lo cubre).

## El Shop tendrá TRES tipos de acción

1. **Comprar con stablecoin** (dinero real → item/Peones) → **primitiva B (rail)**.
   Generalizar `PEONES_PACKS` a SKUs de Shop. Misma UX elegante del GetPeonesSheet.
2. **Gastar Peones** (moneda off-chain → item) → **sin tx on-chain**: solo un
   **débito en el ledger** (espejo del earn). Lo más frictionless de todo, y será
   el motor del 80% del Shop una vez Peones es la moneda.
3. **Mintear coleccionable** (el item ES un NFT/badge) → **primitiva A**
   (signed-mint). Aquí no se evita la escritura al contrato.

## Paso lógico (sin tomar acción aún)

1. Cerrar + promover el rail de Peones (B) — en curso.
2. Definir el **modelo de moneda del Shop**: por cada item, ¿stablecoin (rail),
   Peones (débito off-chain), o coleccionable (mint)?
3. Construir la primitiva de **gasto de Peones** (débito en ledger) — espejo del
   earn. Es el engine central del Shop.
4. Para items de stablecoin, **reusar el rail** (SKUs sobre el mismo motor).
5. Decisión de producto aparte: **migrar save-score a off-chain por defecto** (mata
   el 429) con mint on-chain opcional para victorias coleccionables.

## Regla mental para no confundirlas

> ¿La acción **mueve dinero** o **escribe un registro/coleccionable**?
> Dinero → rail (B). Registro on-chain → signed-mint (A). Economía interna
> (Peones, scores comunes) → ledger off-chain.
