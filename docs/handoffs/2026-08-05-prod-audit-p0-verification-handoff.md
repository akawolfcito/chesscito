# Handoff — Auditoría de producción: verificación P0–P3 (2026-08-05)

> **Punto exacto de retome:** el P0 está verificado y el parche está diseñado.
> Falta el **GO del founder** para escribir código. Nada del P0 se implementó todavía.

**Documento madre:** `docs/audits/2026-08-05-prod-audit-verification.md` — ahí vive el
veredicto por punto. Este handoff no lo repite: sólo carga lo que hace falta para
retomar sin releer el código.

---

## Qué se hizo

Se verificó contra el código (`main` @ `7ef0c2c3`) una auditoría con datos de
producción de los primeros dos días post-listing. Cuatro prioridades, P0 a P3.
**Cero cambios de código.** El único artefacto nuevo es el doc de auditoría.

## Las cuatro correcciones que la auditoría no tenía

Son lo único que no se deduce releyendo el reporte original.

1. **P0 — no son 3 lecturas, es 1.**
   `@wagmi/core@2.22.1/createConfig.js:123` fija `batch: properties.batch ?? { multicall: true }`
   y `components/wallet-provider.tsx` no lo sobreescribe → los tres `balanceOf` salen
   como **un solo `eth_call`** a Multicall3. "Cuántas de las 3 fallaron" mide siempre
   0 o 3. Lo que discrimina es la **clase de error del transporte**.
   Contrapartida buena: con `allowFailure: true` viem ya devuelve
   `{status:"failure", error}` por entrada — **el error existe hoy y se descarta** en
   `lib/payments/use-get-peones-token-selection.ts:93`. Diagnosticar NO requiere tocar
   el transporte.

2. **P0 — hay un tercer estado que la auditoría no nombró, y explica mejor el volumen.**
   `handlePurchase` no mira `selection.loading`: tocar mientras el multicall está en
   vuelo emite `no-token`. Las otras dos hojas del mismo rail
   (`components/payments/get-peones-sheet.tsx:219`, `season-pass-sheet.tsx:291`) **sí**
   ramifican por `selection.noPayableToken` (`use-get-peones-token-selection.ts:103`).
   La hoja de PRO es la única de las tres que no lo usa.
   1.942 eventos / 574 cuentas = **3,4 por cuenta**: forma de tocar-error-tocar.

3. **P1 — la diferencia FUE deliberada y está escrita.**
   `lib/wallet/web-transports.ts:27-29`: *"MiniPay never touches this: it injects its
   own RPC and keeps its bare `http()` config byte-identical."*
   **Pero esa razón cubre las firmas, no las lecturas.** `useReadContracts` sale por
   *nuestro* `publicClient` → Forno pelado, el mismo endpoint que ese archivo documenta
   devolviendo 403 bajo ráfaga. El comentario justifica no tocar el camino de firma;
   no justifica que el saldo se lea sin respaldo.

4. **P3 — el punto de rate limit está desactualizado.**
   El batching entró el **2026-08-03** (`lib/telemetry.ts:13-37`, "Fase 1"): 20 eventos
   por request o 5 s de idle. El header del archivo cita el incidente de la auditoría
   como el problema **que ya resolvió**. Siguen siendo ~74.000 filas/día, pero ~1/20 de
   los requests. `app/api/telemetry/route.ts:30-47` ya impone límites de body/evento/batch
   **antes** de construir el cliente de Supabase, y `:275` responde 204 sin esperar la base.
   Falta un límite por origen, sí — pero hay que re-dimensionarlo contra el código
   post-batching, no contra el incidente.

## Lo que NO se verificó (y por qué)

- **Las 17 filas `legacy_direct` de PRO** — el código confirma que no se crea intent;
  no se miró la base.
- **Las 3 vistas SECURITY DEFINER** — ninguna migración en
  `apps/web/supabase/migrations/` declara `security_invoker = on`, que es justo lo que
  dispara el aviso. Muy probablemente cierto; falta el SQL contra prod.
- **Upstash y las 1.700-1.900 conexiones** — métricas de plataforma, no del repo.
- No se tocó prod ni se corrió ninguna suite. `apps/web` sigue sin re-verificarse desde
  la sesión anterior.

---

## Próxima acción, literal

**Preguntar el GO y arrancar el P0.** Tres commits TDD, en este orden:

1. **`feat(payments): surface balance-read health`** — `use-get-peones-token-selection.ts`.
   Tipo `BalanceReadHealth { state, reads, ok, errorKind, httpStatus }` exportado, más
   `refetchBalances()` (el `refetch` de `useReadContracts`, ya disponible).
   🔒 **Privacidad — invariante dura:** se emite símbolo y **clase** de error, jamás la
   dirección ni `error.message`. Los errores de viem embeben la URL del RPC y el body
   del request, y ese body lleva la wallet dentro del calldata del `balanceOf`. Mapeo
   por `error.name` contra lista corta; el resto cae en `"unknown"`.
2. **`fix(pro): separate unreadable balance from insufficient balance`** —
   `lib/pro/use-pro-sheet-state.ts:264-270`. Tres ramas: `loading` (no emite nada, CTA
   "Checking balance…") / `unreadable` (`kind:"balance-unreadable"` + copy nueva) /
   `!selected` (`kind:"no-token"`, copy actual). Se **mantiene** el nombre de evento
   `pro_purchase_failed` y se discrimina por `kind`, igual que ya hace el hook en
   `:200-207` — no rompe dashboards.
   Copy nueva en `lib/content/editorial.ts` **y** `lib/content/messages/es.ts` (el guard
   de traducción cubre el bundle entero).
3. **`fix(pro): offer a retry when the balance read failed`** —
   `components/pro/pro-sheet.tsx:520`. Hoy el botón de reintento está condicionado a
   `verifyFailedTxHash`. Generalizar para que también aparezca con `onRetryBalance`,
   reusando el mismo botón y estilos. Sin superficie nueva.

Después, el orden acordado: **P2 mutex + receipts** (arriesga dinero real, parches
chicos) → **P1 transporte** (con el P0 ya midiendo) → **P3**.

## Open questions

- **¿GO para implementar el P0?** Es lo único que bloquea.
- **`pro-sheet.tsx:453-456`** — el link `pro-extend-link` llama `props.onPurchase()`
  sin pasar por `resolveCta`, o sea sin el gate `isConnected` / `isCorrectChain`. Sólo
  alcanzable en estado activo. ¿Entra al P0 o queda aparte?
- **PRO → `treasury_payment_intents`** (P2.4): el ciclo ya existe para el canary de Get
  Peones, así que es reuso. Compra reconciliación de pagos huérfanos. Decisión de
  costo/beneficio pendiente de contar filas.
