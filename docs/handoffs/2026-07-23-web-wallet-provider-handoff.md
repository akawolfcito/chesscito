# Handoff — slice `WebWalletProvider`

> Sesión del **2026-07-24**. El nombre del archivo usa `2026-07-23` por pedido explícito;
> si se prefiere alinear con la convención `YYYY-MM-DD` real del trabajo, renombrar a
> `2026-07-24-web-wallet-provider-handoff.md`.

## Estado

| | |
|---|---|
| Rama | `feat/web-wallet-provider` |
| Commit | `bbf9448b` |
| Base | `main` local (incluye harness Privy mergeado + assets) |
| Delta | **1 commit**, sólo del slice |
| Working tree | limpio (queda `docs/specs/2026-07-23-privy-web-access-audit.md` untracked, **anterior al slice**, no le pertenece) |
| Producción | **no tocada**. Nada mergeado a `main`. |

El gate de Fase 0 está **cerrado** — ver `docs/validations/2026-07-23-privy-celo-phase-0.md`
§10.3/§10.6: firma real, tx confirmada en Celo Sepolia y persistencia de address
**cross-browser** (misma cuenta, otro navegador, misma address ⇒ estable por cuenta, no por
dispositivo).

---

## Archivos creados

| Archivo | Qué es |
|---|---|
| `apps/web/src/lib/wallet/wallet-branch.ts` | tipo `WalletBranch` + `resolveWalletBranch()` |
| `apps/web/src/lib/wallet/__tests__/wallet-branch.test.ts` | 6 tests, **verdes** |

Suite focalizada: **6/6** ✅

---

## Decisión arquitectónica cerrada — SSR / hidratación

**No se puede bifurcar con `isMiniPayEnv()` durante el render.**

`isMiniPayEnv()` lee `window` (`apps/web/src/lib/minipay.ts:31`), así que en SSR devuelve
`false`. El layout (`apps/web/src/app/[locale]/layout.tsx:145`) es Server Component. Bifurcar
ahí produciría:

1. el servidor elige la rama **web** para todos;
2. un cliente MiniPay hidrata con la rama **injected**;
3. hydration mismatch + **remount del árbol wagmi**.

Por eso la resolución recibe el entorno **explícitamente**, y se niega a decidir antes de
hidratar.

### Contrato

```ts
type WalletBranch = "injected" | "privy" | "undecided";

resolveWalletBranch(input: {
  privyEnabled: boolean;  // NEXT_PUBLIC_PRIVY_ENABLED
  hydrated: boolean;      // false en SSR y primer render
  isMiniPay: boolean;     // isMiniPayEnv(); sin sentido hasta hydrated
}): WalletBranch
```

| Estado | Resultado |
|---|---|
| `privyEnabled=false` (cualquier otro input) | `injected` |
| `privyEnabled=true`, `hydrated=false` | `undecided` |
| `privyEnabled=true`, `hydrated=true`, MiniPay | `injected` |
| `privyEnabled=true`, `hydrated=true`, web | `privy` |

**Regla dura, cubierta por un test de propiedad sobre todas las combinaciones:**

```text
Privy nunca es alcanzable desde MiniPay
```

Con el flag apagado devuelve `injected` **incluso antes de hidratar**: el árbol actual
renderiza igual que hoy, sin shell extra ni remount.

### ⚠️ `undecided` NO debe renderizar ningún provider

`undecided` significa *todavía no sé en qué entorno estoy*. Debe renderizar un **shell
estable y mínimo**, nunca `WalletProvider` ni `WebWalletProvider`. Renderizar uno
"provisional" y luego cambiar causa exactamente lo que este diseño existe para evitar:

- montar wagmi dos veces;
- reconexión de wallets;
- invalidación de React Query;
- efectos duplicados;
- flash de identidad incorrecta.

El shell debe ser el mismo markup en SSR y en el primer render del cliente.

---

## Trabajo restante

1. **Transport explícito con `fallback([...])` sólo para la rama web.**
   Motivo en §10.7 del doc de validación: el RPC default de Celo (Forno) devuelve **403 bajo
   ráfaga en browser**. En el smoke la tx salió igual porque **Privy transmite por su RPC
   interno** (`Embedded1193Provider`), pero las lecturas vía wagmi (`useBalance`,
   `useWaitForTransactionReceipt`) **sí** dependen del nuestro. **MiniPay enmascaró esto
   siempre** porque inyecta su propio RPC — por eso `http()` pelado nunca se ejerció en prod.
   Los endpoints concretos **hay que confirmarlos contra la doc de Celo, no de memoria.**
2. Añadir deps en `apps/web`: `@privy-io/react-auth`, `@privy-io/wagmi`.
3. Crear `WebWalletProvider`, **paralelo** a `WalletProvider`. Chain: **mainnet Celo 42220**
   (decidido: los entitlements se anclan a tx de mainnet, en testnet el flujo end-to-end no se
   valida de verdad; el flag off en prod es la red de contención).
4. Añadir `NEXT_PUBLIC_PRIVY_ENABLED` a `apps/web/.env.template`.
   > `NEXT_PUBLIC_PRIVY_APP_ID` ya está en el template (vacío).
   > **`PRIVY_APP_SECRET` se eliminó a propósito**: el backend no usa SIWE, ancla entitlements
   > a tx on-chain keyed por address EVM, así que nunca verifica sesiones de Privy server-side.
   > §8.7 del doc de validación lo menciona como condicional a `verifyAuthToken`, que **no** se
   > va a implementar.
5. Client boundary estable que consuma `resolveWalletBranch` y monte el provider **después**
   de hidratar, respetando la regla de `undecided`.
6. **Nunca** llamar `isMiniPayEnv()` desde un Server Component.
7. `WalletProvider` y toda la rama MiniPay **byte-idénticos**, incluidos sus transports.
8. Flag apagado ⇒ árbol actual sin shell ni remount adicional.

> ⚠️ **§8.2 del doc de validación está desactualizado**: dice "mismos chains/**transports** que
> hoy". Se escribió **antes** del smoke. Manda §10.7. La rama web lleva transport propio.

---

## Tests pendientes

1. Flag apagado conserva el árbol actual.
2. MiniPay **nunca** monta `WebWalletProvider`.
3. La rama web Privy usa el transport `fallback`.
4. MiniPay **no importa ni comparte** la configuración RPC nueva.
5. La address de Privy llega a `usePaymentRail` por los hooks wagmi existentes.
6. Guest sin login sigue progresando localmente.
7. Pagos y entitlements sin cambios.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Hydration mismatch / doble mount de wagmi** | Resuelto por diseño (`undecided` + shell estable). El riesgo vuelve si alguien mueve la decisión al render. |
| **Regresión en MiniPay** — es el camino que hoy factura | Rama byte-idéntica + test 2 y 4. No compartir transports. |
| **Forno 403** deja lecturas web colgadas | Paso 1 (transport con fallback). No es opcional. |
| **`Buffer is not defined`** si el slice corriera sobre Vite | El app es Next/webpack; **verificar, no asumir**. El harness lo sufrió y se arregló con `tools/privy-celo-harness/src/polyfills.ts`. |
| Volumen del bundle de Privy/wagmi en first load | Medir; RainbowKit se removió justamente por ~64KB gz (ver comentario en `wallet-provider.tsx:14-18`). |
| `NEXT_PUBLIC_PRIVY_ENABLED` encendido por error en prod | Off por default; test 1 verifica que off = árbol actual. |

---

## Restricciones vigentes

- No tocar producción · No mergear a `main`
- No modificar pagos, entitlements ni economía
- No implementar account linking
- No montar Privy dentro de MiniPay
- No compartir transports entre ramas
- **No decidir identidad desde estado no hidratado**

---

## Siguiente primer comando recomendado

```bash
git -C <repo> switch feat/web-wallet-provider
```

Y arrancar por el **paso 1** con TDD: escribir primero el test rojo de que la rama web usa un
transport `fallback` y que la config de MiniPay no lo comparte — antes de instalar las deps de
Privy. Es la pieza de lógica pura que queda, y no requiere navegador ni credenciales.
