# Runbook — correr el harness Privy × Celo (founder)

> Paso a paso para cerrar el gate §10.3 de `docs/validations/2026-07-23-privy-celo-phase-0.md`.
> Tiempo estimado: ~15 min (la mayor parte es el setup del dashboard, que se hace una sola vez).
> **No pegues en ningún lado**: session tokens, private keys, OTP, cookies, ni el App Secret.

---

## Parte A — Dashboard de Privy (una sola vez)

En https://dashboard.privy.io:

1. Crear app de **desarrollo** llamada `Chesscito Dev`. **No** usar credenciales de prod.
2. **Login methods** → habilitar **Google** y **Email**.
3. **Embedded wallets** → política = crear para **usuarios sin wallet**
   (`users-without-wallets`). Habilitar **recovery** y **export wallet**.
4. **Allowed domains / origins** → agregar **`http://localhost:5173`**.
   ⚠️ **Esto es lo que más se olvida.** El doc de auditoría dice `localhost:3000`, pero eso
   es el puerto del app Next. **El harness corre en Vite → puerto 5173.** Sin este origin,
   Privy rechaza el login y vas a ver un error de origin, no de credenciales.
   (Si Vite arranca en otro puerto porque 5173 está ocupado, agregá **ese** puerto.)
5. **Supported chains** → confirmar que **Celo** está disponible. El código ya pide
   `celoSepolia` (testnet, chain id `11142220`) como default y `celo` (42220) como soportada.
6. Copiar el **App ID** (empieza con `cl…`). Es un identificador **público** client-side —
   va en `.env.local`, nunca en Git. El **App Secret NO se usa acá**: no lo copies.

---

## Parte B — Levantar el harness

### ⚠️ El harness NO se arranca con el `dev` de la raíz

Son **dos proyectos separados**. Esto es la fuente de confusión #1:

| Comando | Qué arranca | Puertos |
|---|---|---|
| `pnpm run dev` en la **raíz** | `turbo dev` → los 5 paquetes del workspace: `landing`, `web`, `admin`, `hardhat`, `video` | landing `3000`, web `3001` |
| `pnpm -C tools/privy-celo-harness run dev` | **solo el harness** (Vite) | **`5173`** |

El harness vive **fuera** del workspace pnpm a propósito — `pnpm-workspace.yaml` solo
globa `apps/*`, así que `turbo dev` **no lo ve ni lo arranca nunca**. Si corrés el dev de
la raíz y abrís `5173`, no hay nada ahí: es el comportamiento esperado, no un error.

### Pasos

`node_modules` del harness **ya está instalado** → se puede saltear el `install`.

1. Crear el env file:

   ```bash
   cp tools/privy-celo-harness/.env.example tools/privy-celo-harness/.env.local
   ```

2. Editar `tools/privy-celo-harness/.env.local` y poner el App ID de la Parte A:

   ```dotenv
   VITE_PRIVY_APP_ID=cl…tu-app-id
   ```

3. Arrancar **el harness** (desde la raíz del repo, sin `cd`):

   ```bash
   pnpm -C tools/privy-celo-harness run dev
   ```

4. Debe imprimir `ROLLDOWN-VITE v7.x ready` y `➜ Local: http://localhost:5173/`.
   Abrir **esa** URL. Si imprime otro puerto (5174, 5175…) es porque 5173 estaba ocupado
   → volvé a la Parte A.4 y agregá **ese** puerto a los allowed origins de Privy.

> Podés dejar el dev de la raíz corriendo en otra terminal si querés; no interfiere.
> Si algo se rompe al arrancar, reinstalá con
> `pnpm -C tools/privy-celo-harness install --ignore-workspace`.

---

## Parte C — Checklist en el navegador (12 pasos)

Marcá cada uno; anotá los valores que pide el paso 11.

- [ ] **1.** La página carga sin el error "missing App ID".
- [ ] **2.** Click **Login** → elegí **Google** (o email si preferís).
- [ ] **3.** Aparece una **address** `0x…` y el wallet type dice `embedded (privy)`.
      → **Anotá la address.** Es la evidencia clave.
- [ ] **4.** Click **Sign test message** → aparece una firma, sin error.
      → **Anotá la firma truncada** (`0xabc…def`, no completa).
- [ ] **5.** Click **Ensure Celo testnet** → el chain id conectado debe ser **`11142220`**.
- [ ] **6.** Si el balance es 0 / falla por gas: ir a **https://faucet.celo.org**, elegir red
      **Celo Sepolia**, pegar la address del paso 3, pedir fondos. Esperar y reintentar.
      ⚠️ Faucet **oficial** solamente. Nunca mover fondos de mainnet.
- [ ] **7.** Click **Send 0 CELO to self (testnet)** → aparece un **tx hash** y el receipt resuelve.
      → **Anotá el tx hash.**
- [ ] **8.** Verificá el tx en el explorer de Celo Sepolia (opcional, confirma que salió de verdad).
- [ ] **9.** Click **Logout**.
- [ ] **10.** Click **Login** de nuevo, **con la misma cuenta de Google**.
- [ ] **11.** Comparar la address nueva con la del paso 3.
      - **Igual** → ✅ persistencia OK, gate cerrado.
      - **Distinta** → 🛑 **BLOCKER DURO.** Parar acá, no seguir. Avisame y marcamos **NO-GO**.
- [ ] **12.** Pasame estos 5 datos y yo relleno §10.3 y flipeo el veredicto:
      1. App ID **enmascarado** (`cl12…7890`, primeros 4 y últimos 4)
      2. Login usado (google / email)
      3. Address embedded
      4. Firma truncada
      5. Tx hash
      6. Cualquier error que hayas visto en el camino

---

## Qué significa el resultado

| Resultado | Consecuencia |
|---|---|
| Los 12 pasos OK | **GO pleno** → se desbloquea el PR del slice `WebWalletProvider` (§8 del doc de validación) |
| La address **cambia** entre sesiones | **NO-GO** → Privy embedded no sirve como identidad estable; hay que repensar el approach |
| Falla firma o tx en Celo | **NO-GO** → incompatibilidad de chain, no esperada según doc + harness verde |
| Error de **origin** en el login | No es NO-GO — es el paso A.4 (`localhost:5173` faltante). Arreglá y reintentá |

---

## Recordatorios de seguridad

- `.env.local` está gitignoreado. **No lo commitees** ni pegues su contenido en chat.
- El **App Secret nunca entra acá.** El harness tiene un test (`guards.test.ts`) que falla
  si alguien intenta leer `PRIVY_APP_SECRET`.
- La address y el tx hash de **testnet** son públicos — esos sí se pueden pegar.
