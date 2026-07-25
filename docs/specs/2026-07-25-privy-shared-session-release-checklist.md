# Release checklist — sesión Privy compartida entre Learn y Play

> **Fecha:** 2026-07-25 · **Estado:** preparado, **no ejecutado**. Producción intacta.
> Precondición ya cumplida por el founder: dominio de cookies verificado
> (`chesscito.com`, HttpOnly ON, Status Ready) y variables de producción cargadas
> en Vercel sin desplegar.
> Contexto y fundamentos: `docs/specs/2026-07-24-privy-cross-subdomain-session-audit.md`.

---

## Qué entra en este slice

`Disconnect` (el botón que ya existía en el Account Sheet) ahora termina la sesión
**real** en la rama web, no solo la conexión wagmi.

```text
MiniPay                    → Disconnect oculto           (sin cambios)
Web + Privy autenticada    → Disconnect → logout() Privy → WebAccessGate
Web + flag OFF             → Disconnect → disconnect()   (legacy, byte-idéntico)
```

**No** se agregó un botón `Sign out`. **No** se tocó pagos, entitlements, MiniPay,
progreso local ni el nick.

### Archivos

| Archivo | Cambio |
|---|---|
| `src/lib/wallet/wallet-session.tsx` | **nuevo** — contexto + `useWalletSignOut()` |
| `src/components/web-wallet-provider.tsx` | **nuevo** `PrivyWalletSession` con `useLogout()` |
| `src/app/[locale]/arena/page.tsx` | `disconnect()` → `signOut()` |
| `src/components/exercises/exercises-screen.tsx` | `disconnect()` → `signOut()` |
| `src/lib/wallet/__tests__/wallet-session.test.tsx` | **nuevo** |
| `src/components/__tests__/web-wallet-session.test.tsx` | **nuevo** |
| `src/components/__tests__/web-wallet-provider.test.tsx` | mock de `useLogout` |

`account-sheet.tsx` **no se tocó**: es un leaf presentacional y su regla de
visibilidad (`walletIsInterchangeable = isReady && !isMiniPay`) ya cumplía los
requisitos 1 y 2.

---

## Secuencia de release

Cada paso tiene su verificación. **No avanzar sin ella.**

### 1. Merge con el flag OFF

```text
NEXT_PUBLIC_PRIVY_ENABLED=false   ← en producción, sin cambios
```

El merge llega a `main` **local**; el push a `origin/main` lo hace el founder.

- ✅ Verificar: prod se comporta igual que antes del merge. El flag OFF envía todo
  a la rama `injected`, y ahí `useWalletSignOut()` cae al `disconnect()` de wagmi.

### 2. Deploy de Learn y Play (aún con flag OFF)

Los dos deploys de `apps/web`. El código de Privy viaja pero **no se monta**.

- ✅ Verificar: MiniPay entra normal en ambos. Nada visible cambió.

### 3. Activar el Production App ID en ambos

```text
learn → NEXT_PUBLIC_PRIVY_APP_ID = <App ID de producción>
play  → NEXT_PUBLIC_PRIVY_APP_ID = <el MISMO valor>
```

⚠️ **Tienen que ser idénticos.** Dos App IDs distintos = dos bases de usuarios =
dos wallets para la misma persona. Comparar los valores carácter por carácter, no
"me acuerdo que puse el mismo".

- ✅ Verificar: el valor coincide en los dos proyectos de Vercel.

### 4. Activar el flag en ambos

```text
learn → NEXT_PUBLIC_PRIVY_ENABLED=true
play  → NEXT_PUBLIC_PRIVY_ENABLED=true
```

⚠️ **Los dos, o ninguno.** Con el flag prendido en uno solo, el otro sigue en la
rama `injected` y en un browser sin wallet inyectada queda sin address — el
usuario vería un producto roto en el subdominio rezagado.

### 5. Redeploy coordinado

Los dos deploys, lo más juntos posible. Las env vars `NEXT_PUBLIC_*` se inlinean
en build: cambiarlas **no** surte efecto hasta el redeploy.

- ✅ Verificar: los dos builds terminaron.

### 6. Validar la sesión compartida

```text
perfil limpio → learn.chesscito.com → WebAccessGate → login
→ abrir play.chesscito.com en la misma sesión de browser
→ entra directo, SIN gate
```

- ✅ DevTools → Application → Cookies: cookie con domain `.chesscito.com`.
- ✅ Hard refresh en Play: sigue adentro.

### 7. Validar la misma wallet

- ✅ Account Sheet en Learn y en Play: **misma address**, mismo Chesscito ID.
- 🔴 **Si las addresses difieren, PARAR y rollback.** Eso es una wallet duplicada
  por usuario, no un detalle cosmético.

### 8. Validar Disconnect

```text
Account Sheet en Learn → Disconnect
→ Learn muestra WebAccessGate
→ la cookie de .chesscito.com desaparece
→ refrescar Play → WebAccessGate
```

- ✅ El progreso local y el nick siguen ahí tras volver a entrar.
- ℹ️ Una pestaña de Play **ya abierta** no se entera en vivo (no hay canal
  cross-origin). Se entera al refrescar o al reabrir. Es el comportamiento
  esperado, no un bug.

### 9. Validar MiniPay (el camino que factura)

- ✅ Abrir `learn.` y `play.` **dentro de MiniPay**: entra directo con la wallet
  MiniPay, **sin gate**.
- ✅ El Account Sheet en MiniPay **no muestra Disconnect**.
- ✅ Un pago funciona igual que antes.
- ✅ `chesscito.com` sigue sin login y sin Privy.

### 10. Rollback

| Nivel | Acción | Efecto |
|---|---|---|
| **1** | `NEXT_PUBLIC_PRIVY_ENABLED=false` + redeploy | Vuelve entero a la rama `injected`. Es el rollback total. |
| **2** | `NEXT_PUBLIC_PRIVY_APP_ID` → App de desarrollo + redeploy | Privy sigue, vuelve a `localStorage`, sesiones separadas. |
| **3** | HttpOnly cookies OFF en el dashboard | Revierte el mecanismo en el origen. |

Los DNS pueden quedar puestos: sin la app apuntando a ellos son inertes, y
sacarlos obliga a re-esperar propagación. **Excepción:** si un CAA mal cargado
rompiera la emisión de certificados, revertir ese sí es urgente.

**Costo de un rollback para el usuario:** hay que volver a loguear. **No** se
pierde ninguna wallet — la embedded wallet vive en Privy atada al user ID, no en
el navegador.

---

## Riesgos vigentes

| Riesgo | Mitigación |
|---|---|
| App IDs distintos entre Learn y Play | Paso 3 los compara explícitamente |
| Flag prendido en un solo subdominio | Paso 4 lo declara todo-o-nada |
| Env var cambiada sin redeploy | Paso 5 — `NEXT_PUBLIC_*` se inlinea en build |
| Wallet duplicada | Paso 7 es un gate rojo con rollback |
| Regresión en MiniPay | Paso 9 + tests; la rama `injected` no cambió |
| Pestaña abierta sobrevive al logout | Documentado en el paso 8; no es un fallo |

## Hallazgo lateral, fuera de este slice

`WebWalletProvider` **no** monta `EffectiveTrainingPassProvider` ni
`ThemeVariantProvider`, que la rama `injected` sí monta
(`wallet-provider.tsx:69-71`). Cualquier superficie que consuma esos contextos
puede comportarse distinto en la rama web. **No lo toqué** — excede el slice —
pero conviene resolverlo antes del paso 4.
