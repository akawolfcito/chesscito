# MiniPay/Celo Primitives — Research para Chesscito Lite

**Fecha:** 2026-06-24  
**Fuente:** celopedia-skill (minipay-guide.md, minipay-templates.md, minipay-requirements.md, minipay-live-apps.md, builder-guide.md, network-info.md)  
**Contexto:** Chesscito Lite es una app de hábitos cognitivos para mobile-first MiniPay. Se evalúa la mejor primitiva para una primera transacción real: útil, viral, alineada con hábitos saludables, no especulativa.

---

## 1. Stablecoins en MiniPay

MiniPay soporta **exactamente tres stablecoins**. CELO nunca debe aparecer en UI.

| Token | Dirección (mainnet) | Decimals | feeCurrency address |
|---|---|---|---|
| **USDm** (ex-cUSD) | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | 18 | misma dirección del token |
| **USDC** | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 | `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B` (adapter) |
| **USDT** | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 6 | `0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72` (adapter) |

**Nota crítica:** USDm es la más simple — 18 decimals, `feeCurrency == token address`, no adapter. USDC/USDT requieren el address del adapter separado para CIP-64.

**Estado en Chesscito:** el codebase ya acepta USDC/cUSD/USDT en `lib/payments/rail-config.ts`. USDm no está configurado (`lib/payments/rail-config.ts:64` — "USDm is NOT configured and is out of scope"). Para producción completa, agregar USDm al accepted set.

**Requisito de listing:** la app DEBE adaptarse al token preferido del usuario dinámicamente (el que tiene más balance). Si el saldo es cero en todos → redirigir a `https://minipay.opera.com/add_cash` con label "**Deposit**" (no "Add Cash", no "Buy Crypto").

---

## 2. Detección de wallet MiniPay y auto-connect

```typescript
// Detección
function isMiniPay(): boolean {
  return typeof window !== "undefined"
    && window.ethereum !== undefined
    && window.ethereum.isMiniPay === true;
}

// Auto-connect (requerido — NO mostrar botón "Connect Wallet" dentro de MiniPay)
useEffect(() => {
  if (window.ethereum?.isMiniPay) {
    connect({ connector: injected({ target: "metaMask" }) });
  }
}, []);
```

**Chesscito ya tiene esto implementado** en `hub-scaffold-client.tsx` (prop `isWalletConnected`). La detección usa `lib/minipay.ts:isMiniPayEnv()`.

**Importante:** MiniPay docs dicen que `personal_sign` y `eth_signTypedData` NO están soportados. Sin embargo, la prueba on-device de Chesscito (2026-06-12) confirmó que `personal_sign` **sí funciona**. Tratar como best-effort, no garantizado entre versiones de MiniPay. Usar con precaución para flows de firma.

---

## 3. Primitiva de pago: Transfer directo vs. Contrato vs. Entitlement off-chain

| Primitiva | Complejidad | Fit MiniPay | Fit Chesscito Lite |
|---|---|---|---|
| **`ERC20.transfer(treasury, amount)` directo** | Baja | ✅ Óptimo — legacy tx, sin approve | ✅ Ya implementado en `api/verify-payment` |
| Llamada a contrato (`safeTransferFrom` o `buyItem`) | Media | ✅ Funciona (Shop lo usa) | Full-only — no en Lite |
| **Entitlement off-chain post tx verificada** | Baja backend | ✅ Ideal para Lite | ✅ Patrón exacto del rail actual |
| Escrow / contrato de pool | Alta | ⚠️ Requiere deploy + auditoría | Descartar fase 1 |

**Recomendación para Lite:**

> `token.transfer(treasury, amount)` → servidor verifica `getTransactionReceipt()` → acredita entitlement en Supabase/Redis de forma idempotente.

Esta es exactamente la arquitectura de `/api/verify-payment` en Chesscito. El único bloqueador es configurar `CHESSCITO_TREASURY_ADDRESS` en Vercel.

**Por qué NO contrato propio:**
- Requiere deploy + auditoría (semanas y costo)
- Chesscito Lite no necesita lógica on-chain en la transacción — el valor es el entitlement off-chain (shields, acceso, badge)
- El Shop de Chesscito Full ya tiene un contrato; reutilizarlo en Lite contaminaría la separación

---

## 4. Cash Link / Shareable Payment Links

MiniPay **no tiene** una primitiva nativa de cash link o payment link compartible (no existe equivalente a Lightning LNURL o Coinbase Pay links).

El único deeplink documentado es el de depósito:
```
https://minipay.opera.com/add_cash
```

**Patrón disponible para "Gift a Habit Pack" y "Challenge a Friend":**
1. El gifter paga a treasury (`transfer(treasury, amount)`)
2. El servidor genera un código de regalo (UUID en Supabase, firmado server-side)
3. Se comparte URL: `chesscito.com/gift?code=ABC123` (o share/badge/daily como ya existe)
4. El receptor abre la URL en MiniPay → conecta wallet → reclama entitlement sin pagar
5. Código marcado como usado (idempotente)

Este es un flujo off-chain custom — no una primitiva nativa de MiniPay.

---

## 5. Microtransacciones en Celo

| Métrica | Valor |
|---|---|
| Gas promedio por tx | ~$0.0005 |
| Tiempo de bloque | ~1 segundo |
| Mínimo viable (producto) | Sin mínimo on-chain; rango óptimo $0.10–$1.00 para apps de hábito en mercados emergentes |
| Fee con USDm feeCurrency | User paga solo en USDm — invisible a nivel precio si el pack cuesta $0.25+ |

Para una compra de $0.25 de Streak Shield Pack: el fee on-chain añade $0.0005 — **el usuario no lo percibe**. La confirmación es sub-segundo en la wallet, 1–2 segundos en UI con receipt.

---

## 6. Best Practices para Mini Apps MiniPay (requisitos de listing)

### Requerimientos técnicos obligatorios

| Requisito | Chesscito Lite hoy |
|---|---|
| Auto-connect sin botón "Connect Wallet" | ✅ Implementado |
| Sin mostrar addresses raw `0x...` al usuario | ✅ Avatar + nickname (Identity Lite P1) |
| Solo stablecoins en UI (nunca CELO) | ✅ |
| Copy: "Network fee" no "Gas"; "Deposit" no "Add Cash" | ⚠️ Revisar copy en `get-peones-sheet.tsx` |
| Imágenes WebP/SVG | ✅ (triplete png/webp/avif en assets) |
| Viewport 360×640 mínimo | ✅ (390px — excede) |
| PageSpeed score mínimo | ⚠️ No auditado antes del submit |
| Enlace de soporte in-app (Telegram/WhatsApp/email) | ✅ `/support` page |
| ToS + Privacy Policy in-app | ✅ `/terms` + `/privacy` |
| Stats page (DAU, MAU, tx volume, network fees) | ⚠️ `api/admin/lite-stats/` existe — verificar si satisface |
| Legacy tx (no EIP-1559 — no `maxFeePerGas`) | ✅ El rail usa CIP-64 feeCurrency que resuelve esto |
| SLA 24h para fixes críticos | Organizacional |
| 2MB bundle size recommendation | ⚠️ No auditado |

### Requerimientos UX obligatorios

- Sin carrusels de onboarding (ya en MEMORY: `feedback_no_carousels.md`)
- Sin login nativo — la wallet ES la identidad
- Flujos cortos: el pago completo debe completarse en ≤3 taps desde el trigger

---

## 7. Direct Transfer vs. Contrato vs. Off-chain — Veredicto final

**Para una primera transacción en una habit app:** Direct ERC20 transfer + off-chain entitlement.

**Razonamiento:**
1. Chesscito ya tiene el 90% del código — `api/verify-payment` solo necesita un SKU adicional
2. Cero riesgo de contrato (no deploy, no auditoría, no reentrancy risk)
3. Legacy tx — MiniPay compatible out of the box
4. Idempotente + anti-replay + fail-closed: ya implementado con `buildPaymentIdempotencyKey()`
5. Funciona con los tres tokens soportados vía `getPreferredStablecoin()` pattern
6. Block time ~1s en Celo → UX de confirmación casi instantánea

---

## 8. Templates y código disponibles (Celopedia)

Templates disponibles en `celopedia-skill/references/minipay-templates.md`:

| Template | Relevancia para Chesscito Lite |
|---|---|
| Next.js starter page (detect + connect + balance + transfer) | ✅ Alta — base del flow de pago |
| `useMiniPay()` hook (wallet state, balance refresh) | ✅ Alta — complementa `usePaymentRail` |
| Stablecoin payment flow (balance check + encode + send + receipt) | ✅ Alta — base ya implementada en Chesscito |
| Bill Payment pattern (recurring/amount-entry) | ⚠️ Media — útil para Daily Mind Pass |
| Multi-token balance display | ✅ Alta — token selector en shield sheet |
| `getPreferredStablecoin()` (picks highest balance, handles zero → Deposit link) | ✅ Alta — reutilizable directamente |

Todos usan **Viem v2 + CIP-64 fee abstraction** — compatible con el stack actual de Chesscito (Viem/Wagmi).

---

## 9. Mini Apps con hábito / educación / social (live catalog)

Catálogo de apps publicadas en MiniPay relevantes (snapshot 2026-04-09):

| App | Categoría | Patrón de hábito | Relevancia para Chesscito |
|---|---|---|---|
| **Squadletics** | health-fitness | Earn while you exercise | ✅✅ Más cercano — hábito saludable + crypto reward |
| **Daily Reward** | rewards | Recompensa por volver cada día | ✅ Streak/return mechanic puro |
| **Akiba Miles** | rewards | Acciones diarias → puntos | ✅ Daily action → reward |
| **Learn & Earn** | rewards | Cursos completados → reward | ✅ Educación → reward |
| **Myriad** | rewards | Daily rewards | ✅ Loop diario |
| **Halo** | rewards | Verificación de acción (snap receipt) | ⚠️ Verificación pattern — útil para Proof of Practice |
| **MiniFunder** | art-creativity | Financiar proyectos creativos | ⚠️ Sponsor a Puzzle analogy |
| **Kliq** | rewards | Micro-engagement | ⚠️ Muy básico |

**Gap identificado:** No existe ninguna app de hábitos **cognitivos** (ajedrez, puzzles, entrenamiento mental) en el catálogo. Chesscito Lite sería **el primero** en este espacio dentro de MiniPay. Squadletics es el competidor más cercano pero en fitness físico.

**Patrón dominante en apps exitosas:** reward-for-return, no pay-to-play. Los usuarios ganan algo por acciones diarias. Cuando hay pago, es pequeño ($0.10–$1.00) y desbloquea un beneficio inmediato claro (más vidas, un pase, un shield).

---

## 10. Riesgos y limitaciones en iOS/Android

| Riesgo | Detalle | Mitigación |
|---|---|---|
| **Android predominante** | 10 de 48 apps publicadas son Android-only. iOS históricmamente limitado. | Confirmar soporte iOS antes del demo con MiniPay |
| **Dispositivo físico requerido** | No emuladores para MiniPay. Para local dev: ngrok. | Tener device listo antes de demo |
| **Legacy tx obligatoria** | No campos EIP-1559 (`maxFeePerGas`, `maxPriorityFeePerGas`). | Chesscito ya usa CIP-64 — sin acción |
| **`personal_sign` no oficial** | Docs dicen no soportado; Chesscito confirmó que funciona on-device (2026-06-12). | Usar solo para badge signing, no para payment flow. Payment no necesita sign |
| **Bundle size** | 2MB recomendado. | Auditar con `next build --analyze` antes de submit |
| **Calidad de red** | Target = Android económico + conectividad intermitente. | Timeouts largos, loading states, retry automático (ya en `usePaymentRail:35`) |
| **PageSpeed gate** | Score bajo bloquea listing. | Auditoria Lighthouse antes de submit |
| **USDm no configurado en Chesscito** | `lib/payments/rail-config.ts:64` — fuera de scope hasta configurar. | Agregar antes de listing oficial |

---

## Tabla de recomendación por use case

| Use Case | Primitiva recomendada | Token sugerido | Precio | Complejidad | Estado Chesscito |
|---|---|---|---|---|---|
| **Streak Shield Pack** | Direct ERC20 transfer → off-chain shields (Redis) | User's preferred (USDm/USDC/USDT) | $0.25–$0.50 | Baja | 90% existe — agregar SKU + sheet |
| **Daily Mind Pass** | Direct ERC20 transfer → Supabase TTL entitlement | User's preferred | $0.10/día o $0.99/semana | Baja-Media | SKU nuevo + expiry logic |
| **Challenge a Friend** | Server-signed gift code + URL share | Gifter paga treasury | $0.25–$0.50 | Media | No existe — custom claim flow |
| **Gift a Habit Pack** | Server-signed gift code + URL share | Gifter paga treasury | $0.50–$1.00 | Media | No existe — viral upside alto |
| **Sponsor a Puzzle** | Direct ERC20 transfer → pool tracking en Supabase | USDm (community feel) | $0.50–$2.00 | Media-Alta | No existe — necesita puzzle attribution |

---

## Recomendación de primitiva única para primera transacción

**`ERC20.transfer(treasury, amount)` → entitlement off-chain verificado**

Aplicado a: **Streak Shield Pack** ($0.25–$0.50 → 3 shields)

**Por qué esta primitiva + este use case es la mejor combinación:**

1. **Técnico:** 90% ya implementado en Chesscito. `/api/verify-payment` solo necesita un nuevo SKU. No deploy, no auditoría.
2. **UX:** El momento de trigger (fail + shields = 0) es el de máxima intención de pago — el usuario YA quiere proteger su racha.
3. **Narrativo:** "Protege tu hábito" > "Compra monedas". Shields son una mecánica de protección, no especulación.
4. **Viral mínimo:** El usuario comparte que "mantuve mi racha de N días" — el shield es el instrumento que lo hizo posible.
5. **Ecosistema:** Squadletics (el app más análogo en MiniPay) valida que hábito + reward on-chain tiene tracción.
6. **Riesgo:** Cercano a cero. Falla-closed si treasury no está configurada. Idempotente si la tx se repite. Sin contrato nuevo.

---

## Próximos pasos para listing en MiniPay

Una vez implementada la primera transacción:

1. **Auditar PageSpeed** con Lighthouse mobile (`next build` + `vercel --prod`)
2. **Agregar USDm** al accepted stablecoin set (`rail-config.ts`)
3. **Implementar `getPreferredStablecoin()`** — picks token con mayor balance, cae a Deposit deeplink si cero
4. **Revisar copy**: "Network fee" no "Gas", "Deposit" no "Add Cash" en toda la UI de pagos
5. **Stats page**: confirmar que `api/admin/lite-stats` retorna DAU/MAU/tx_volume/fees
6. **Smoke test en device físico**: ngrok + Android MiniPay físico, no emulador
7. **Confirmar iOS support** con el equipo de MiniPay antes de prometer en demo
