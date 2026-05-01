# Web3 Terminology Softening Pass — Audit (2026-05-01)

> Regla editorial: hablar primero en lenguaje humano; explicar Web3 solo cuando aporte confianza, trazabilidad o contexto técnico.

---

## 1. Términos en alcance

| Web3 term | Public term |
|---|---|
| NFT | digital collectible / badge / card |
| Victory NFT | Victory Card |
| Founder NFT | Founder Badge |
| on-chain / onchain | verifiable / publicly recorded / transparent |
| mint / minted | save / collect / create |
| minted to your wallet | yours to keep / saved to your account |
| wallet | MiniPay account / account |
| transaction | payment / confirmation |
| smart contract | transparent payment infrastructure |
| blockchain | transparent infrastructure / Celo infrastructure |
| token | stablecoin / CELO |
| gas fee | network fee |
| address | account ID / supporter profile |

---

## 2. Triage por archivo

### A. `docs/business/chesscito-business-model-minipay-brief.md`

| Línea | Término | Decisión | Reemplazo |
|---|---|---|---|
| 14 | "ni una colección de NFTs" | **KEEP** | Refutación intencional ("no es solo X ni Y") — el término es necesario para anclar la diferenciación |
| 27 | "aliados web3" | **REPLACE** | "ecosystem allies" |
| 27 | "NFTs de apoyo" | **REPLACE** | "supporter badges" |
| 30 | "se acumula on-chain" | **REPLACE** | "se acumula públicamente" |
| 46 | "onboarding de wallet" | **REPLACE** | "onboarding de cuenta" |
| 60 | "guardado on-chain" | **REPLACE** | "guardado de forma verificable" |
| 60 | "No se presenta como NFT especulativo" | **KEEP** | Meta-instrucción al equipo — no es copy de superficie |
| 77 | "no solo wallet" | **REPLACE** | "no solo cuenta anónima" |
| 90 | "trazable on-chain" | **REPLACE** | "trazable públicamente" |
| 110 | "contratos on-chain" | **REPLACE** | "infraestructura verificable de Celo" |
| 114 | "web2, web3 e IA" | **KEEP** | Bio técnica de Den Labs — posicionamiento preciso para audiencia técnica |
| 129–130 | "¿Por qué blockchain?" | **KEEP** | Pregunta real de MiniPay; la respuesta ya enmarca como infraestructura |
| 139 | "shop on-chain", "badges on-chain", "verificación on-chain" | **REPLACE** | "tienda con pagos transparentes", "badges verificables", "verificación de pago" |
| 158 | "mecánica on-chain" | **REPLACE** | "mecánica de soporte verificable" |
| 176 | "vender NFTs como especulación" | **KEEP** | Meta-instrucción de constraints, no copy de superficie |

### B. `apps/web/src/lib/content/editorial.ts` — superficie pública

| Línea | Término | Decisión | Reemplazo |
|---|---|---|---|
| 77 | "The best scores recorded on-chain." | **REPLACE** | "The best scores publicly recorded." |
| 86 | "is now in your wallet" | **REPLACE** | "is now yours to keep" |
| 282 | "Waiting for onchain confirmation." | **REPLACE** | "Waiting for confirmation." |
| 283 | "Your score is now recorded onchain." | **REPLACE** | "Your score is publicly recorded." |
| 284 | "Your badge is now confirmed onchain." | **REPLACE** | "Your badge is now confirmed." |
| 285 | "Your purchase is now confirmed onchain." | **REPLACE** | "Your purchase is now confirmed." |
| 445 | "Your onchain victories, immortalized." | **REPLACE** | "Your verifiable victories, immortalized." |
| 461 | `nftIdPrefix: "NFT"` | **REPLACE** | `cardIdPrefix: "Card"` (rendered as "Card #123") |
| 522 | "unique on-chain collectibles" | **REPLACE** | "unique verifiable collectibles" |
| 575 | "20% of every Victory mint" | **REPLACE** | "20% of every saved Victory" |
| 848 | "gamified on-chain challenges on Celo" | **REPLACE** | "gamified, verifiable challenges on Celo" |
| 1234 | "Insignias de progreso on-chain" | **REPLACE** | "Insignias de progreso verificables" |
| 1249 | "Mint de tus victorias sin costo del NFT" | **REPLACE** | "Guarda tus victorias sin costo extra" |
| 1276 | "Trazabilidad on-chain de cada aporte" | **REPLACE** | "Trazabilidad pública de cada aporte" |
| 1299 | "Cada badge y aporte vive on-chain..." | **REPLACE** | "Cada badge y aporte queda registrado de forma transparente..." |

### C. `editorial.ts` — error/recovery toasts y prompts (KEEP)

Los siguientes están en estados técnicos donde "wallet" describe una interacción real que el usuario está haciendo. Mantener como precisión de UX:

- Línea 28: `connectWallet: "Connect Wallet"` (action button label)
- Línea 103, 121, 127–128, 269, 414, 419–420, 452–453, 923: mensajes de error/recovery de wallet (timeout, declined prompt, switch network)

### D. `editorial.ts` — copy legal (KEEP)

LEGAL_COPY (líneas 729-790) usa intencionalmente "blockchain", "wallet address", "on-chain transactions", "smart contracts" porque es **lenguaje legalmente requerido para precisión**. Cambiarlo erosionaría la disclosure de privacidad y términos. Decisión: **KEEP** todo el bloque.

### E. Archivos no encontrados

- `docs/business/chesscito-minipay-pitch-deck-outline.md` — no existe aún (pendiente per Next Steps #8 del brief).

---

## 3. Reemplazos aplicados en este pase

Phase 1: brief completo + editorial.ts public surfaces.
Phase 2 (deferred): pitch deck outline (no creado aún).

---

## 4. Riesgos y términos que se mantienen

| Término | Razón |
|---|---|
| "NFTs" en línea 14 brief | Refutación intencional para diferenciar del estereotipo Web3 |
| "Connect Wallet" en CTAs | Acción técnica universal; cambiarlo confundiría más de lo que ayuda |
| "Wallet" en mensajes de error | El usuario está literalmente interactuando con un wallet; el término describe la realidad |
| LEGAL_COPY completo | Disclosure legal precisa; cualquier cambio requiere revisión legal |
| Comentarios JSDoc internos | Documentación de código, no superficie pública |
| "web2 / web3" en Den Labs bio | Posicionamiento técnico para audiencia técnica |
| "¿Por qué blockchain?" como pregunta | Es la pregunta real que MiniPay/inversores hacen; la respuesta la reframea |

---

## 5. Acceptance criteria

- ✅ Una persona Web2 entiende el documento sin saber qué es un NFT.
- ✅ Una persona Web3 entiende que hay assets verificables y Celo/MiniPay por debajo.
- ✅ El pitch sigue siendo fuerte para MiniPay.
- ✅ Blockchain aparece como infraestructura, no como hype.
- ✅ Cero términos como NFT/on-chain/mint en headlines, taglines o CTAs públicos.
- ✅ Cada término técnico que permanece tiene una razón clara documentada arriba.
- ✅ Legal copy intacta (precisión técnica obligatoria).
