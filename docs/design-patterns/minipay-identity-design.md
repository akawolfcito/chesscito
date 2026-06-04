# MiniPay Identity Design — sin ODIS

**Date:** 2026-06-03
**Status:** **DECIDIDO 2026-06-03 — validación pendiente con grupo MiniPay/Celo, NO bloqueante para readiness submission.**

## Decisión confirmada 2026-06-03

- ❌ **No** implementar ODIS.
- ❌ **No** implementar identity alias todavía (ni Pattern A, ni A+C).
- ✅ **Validar primero** con grupo MiniPay/Celo si Pattern A+C cumple expectativas §1.3.
- ✅ **Interim:** mantener address truncada SÓLO en Account sheet como hint secundario. No exponer raw `0x…` en Hub, Arena, Coach, /stats.
- 🚫 **No blocker de readiness.** Si el grupo confirma alias-app-local OK, se planifica cluster post-readiness submission.
- 📨 **Acción inmediata:** enviar 5 preguntas al grupo (ver §10 mensaje listo).


**Source:** `celopedia-skill / minipay-guide.md` + `odis-socialconnect.md` + Chesscito runtime audit
**Decisión raíz:** No implementar ODIS por ahora. Diseñar identidad amigable con lo que MiniPay realmente expone + señales adyacentes.

---

## 1. TL;DR

MiniPay NO expone teléfono, email, nombre, ni país directamente. Lo único garantizado en runtime es:

- `window.ethereum.isMiniPay === true`
- `window.ethereum` provider (vanilla EVM-injected, sin `personal_sign`/`signTypedData`)
- Address(es) vía `eth_accounts`
- Chain ID Celo mainnet (42220)

**Todo lo demás** (teléfono, perfil, país) requiere o ODIS reverse-lookup (no queremos), o señales adyacentes (browser locale, IP geo, on-chain history). El spec MiniPay **explícitamente** acepta **alias app-local** como identidad primaria en lugar de teléfono.

→ El espacio de diseño es: **persona temática chess + locale-aware greeting + on-chain achievements**, sin ODIS y sin pedir datos.

---

## 2. ¿Qué expone MiniPay realmente en runtime? (cold truth table)

### 2.1 Directo desde `window.ethereum`

| Señal | Disponible | Notas |
|-------|-----------|-------|
| `isMiniPay: true` | ✅ | Flag de detección. Único modo confiable de saber que estamos dentro. |
| `eth_accounts` → `[0x…]` | ✅ | Address del usuario. Sólo 1 cuenta típicamente. |
| `eth_chainId` → `0xa4ec` (42220) | ✅ | Celo mainnet. |
| `eth_sendTransaction` | ✅ | Legacy tx only (no EIP-1559). |
| `eth_estimateGas`, `eth_gasPrice` | ✅ | Con `feeCurrency` param. |
| `personal_sign` | ❌ | **NO soportado.** |
| `eth_signTypedData` | ❌ | **NO soportado.** |
| Teléfono | ❌ | NO hay método `getPhone`. Requiere ODIS reverse. |
| Email | ❌ | No se expone jamás. |
| Nombre real | ❌ | No se expone jamás. |
| Avatar/foto | ❌ | No se expone jamás. |
| País oficial | ❌ | No se expone (inferible vía locale/IP). |

### 2.2 Inferible vía browser (sin pedir permiso)

| Señal | API | Calidad de señal |
|-------|-----|------------------|
| Locale | `navigator.language` (`"es-MX"`, `"pt-BR"`, `"en-NG"`) | **Alta** — usuarios MiniPay en 60+ países, varía mucho |
| Locales preferidos | `navigator.languages` | Alta — fallback ordenado |
| Timezone | `Intl.DateTimeFormat().resolvedOptions().timeZone` (`"America/Mexico_City"`) | **Media-alta** — buena proxy de país para emerging markets |
| User-Agent | `navigator.userAgent` | Media — confirma WebView MiniPay vs browser standalone |
| Pantalla | `window.innerWidth/innerHeight` | Baja — sólo para responsive |

### 2.3 Inferible vía server (Vercel edge headers)

| Señal | Header | Calidad |
|-------|--------|---------|
| País | `x-vercel-ip-country` (`"MX"`, `"NG"`, `"BR"`) | **Alta** — geo-IP Vercel, gratis, sin pedir permiso |
| Ciudad | `x-vercel-ip-city` | Media |
| Región | `x-vercel-ip-country-region` | Media |
| IP | `x-forwarded-for` | Sensible — no almacenar sin consent |

### 2.4 Inferible vía on-chain (Celo RPC, sin ODIS)

| Señal | Cómo se obtiene | Valor para identidad |
|-------|----------------|----------------------|
| Balances USDT/USDC/USDm | `balanceOf` cada token | Proxy de "ya es usuario activo de stablecoin" → ajusta onboarding |
| Stablecoin preferido | el de mayor balance | Personaliza pricing UI |
| Primera tx de la address | Celoscan/Blockscout API | "Veterano" vs "nuevo" → tone de bienvenida |
| Badges Chesscito ya colectados | LabyrinthBadges + Badges contract reads | Returning user → skip onboarding, mostrar progreso |
| Victorias Chesscito (mints) | Eventos contract Chesscito | Identidad ganada por mérito ("Maestro de la Torre") |
| ENS/Celo Name Service | Resolver reverse | **Poco probable** en MiniPay (target user no setea ENS) |

---

## 3. ¿Qué dice el spec MiniPay sobre identidad?

Cita literal (`minipay-requirements.md` §1.3 + `minipay-guide.md` §"UI rule"):

> "**never display raw `0x…` addresses** as the primary identifier. Show the phone number (resolved via ODIS → FederatedAttestations), **an app-specific alias / username the user has set**, or a truncated `0x…abc` only as a **secondary** hint."

**Traducción operacional:**

- ✅ Phone number (requiere ODIS) — descartado
- ✅ **App-specific alias / username** — vía libre
- ⚠️ Truncated address — sólo como hint **secundario**

→ Diseñar el alias **es** la solución compliant. No necesitamos pedir nada al usuario que MiniPay no exponga.

---

## 4. Espacio de diseño para Chesscito

Chesscito tiene material temático excepcional para identidad (piezas, reinos, rangos, hazañas). El input mínimo es el address; todo lo demás lo construimos sobre eso.

### 4.1 Cuatro patrones candidatos

| Patrón | Descripción | Pros | Contras | Reference |
|--------|-------------|------|---------|-----------|
| **A. Codename generado determinístico** | Hash de la address → `Adjetivo + Pieza + #NNN`. Ej: `"Caballo Dorado #2847"`. Determinístico, sin onboarding, sin storage. | Cero fricción. Persistente sin DB. Funciona para usuario nuevo igual que returning. | Menos "mío". Hard to remember si cambian de device sin recover phrase. | Reddit usernames, Steam personas |
| **B. Codename + posibilidad de override** | Mismo A, pero el usuario puede tap "elegir el mío" en Account sheet → input local. Persiste localStorage + opcional commit on-chain (memo en tx o contrato `chesscitoNames`). | Personalizable. Sigue funcionando si no eligen. | Storage strategy decisión. localStorage se pierde si reinstall MiniPay. | Discord (tag + custom name), Lichess (random + edit) |
| **C. Identidad ganada por mérito** | El alias evoluciona con on-chain progress. `"Aprendiz"` → `"Maestro de la Torre"` → `"Gran Maestro"` según badges colectados. | Mecánica de juego integrada con identidad. Refuerza retorno. | No funciona para usuario fresh. Necesita fallback (codename A para day-0). | Duolingo league tier, Clash Royale arena name |
| **D. Avatar + título sin nombre** | No usar nombre. Mostrar pieza-avatar (asset Chesscito) + título corto contextual (`"Jugador veterano"`, `"Coleccionista activo"`). Address truncada sólo en Account/Receipt. | Cero nombre = cero awkward. Encaja tono visual del juego. | Menos personal. Identifica menos al usuario. | iOS Memoji, Reddit anonymous-first |

### 4.2 Recomendación: **A + C combinado**

**Day-0 fresh user:** codename determinístico generado del address (Patrón A). Cero onboarding.

**Returning user con progreso:** el codename sigue, pero el **título contextual** evoluciona con badges (Patrón C). Ej:

- 0 badges → `"Caballo Dorado #2847 · Aprendiz"`
- 5 badges Torre → `"Caballo Dorado #2847 · Maestro de la Torre"`
- PRO activo → `"Caballo Dorado #2847 · Estratega PRO"` (subtitle dorado)

**Account sheet:** address truncada visible como hint (`0x4f3a…b219`), botón "copiar" para los pocos que la necesitan. Sin warnings, sin jerga.

**Por qué no Patrón B (override):** introduce un input + decisión de storage + edge cases (duplicados, profanity filter, persistencia cross-device). Patrón A+C cubre 95% del valor sin esa deuda. Si más adelante MiniPay listing requiere identidad editable, B es additive sobre A.

### 4.3 Greeting/copy layer con señales adyacentes

Sobre el alias, se modula con **locale** (`navigator.language`) e **IP country** (server-side):

- `es-MX` → `"Hola, Caballo Dorado"` (tú formal/informal según país)
- `pt-BR` → `"Olá, Cavalo Dourado"` (i18n catalog ya existe en Chesscito)
- `en-NG` → `"Welcome, Golden Knight"`

Cero datos personales. Sólo locale routing (que ya hace `i18n` middleware de Next.js).

### 4.4 Asset budget (sin código aún)

- **Vocabulario de adjetivos** (~30 EN + ES + PT) — pool semántico (Dorado, Esmeralda, Sombrío, Veloz...)
- **Pool de piezas** (6 — Rey, Reina, Torre, Alfil, Caballo, Peón)
- **Algoritmo determinístico** — `keccak256(address) → [adjetivo_index, pieza_index, número_3dig]`
- **Pool de títulos contextuales** (~15 por idioma) — Aprendiz, Maestro de la X, Estratega, Coleccionista, Veterano...
- **Avatares por pieza** — Chesscito ya tiene assets de personajes piezas (memory `theme-system-foundation`)

---

## 5. Información que NO necesitamos y NO debemos pedir

| Dato | ¿Pedirlo? | Razón |
|------|----------|-------|
| Email | ❌ | MiniPay no lo da. Pedirlo = friction. Compliance MiniPay copy: no jerga de signup. |
| Teléfono | ❌ | Requeriría ODIS. Usuario decisión: no. |
| Nombre real | ❌ | Alias temático > nombre real para juego. |
| Username custom | ⚠️ Posponer | Patrón B es additive. Day-1 sin él. |
| Avatar custom upload | ❌ | Storage cost, moderation cost, MiniPay 2MB footprint. |
| Bio / about | ❌ | Fuera de scope MiniPay UX (mini app, no red social). |
| Country/ciudad explícito | ❌ | Server-side IP geo cubre necesidad si surge. |

---

## 6. Estado actual Chesscito vs diseño propuesto

Sin tocar código, qué tenemos hoy y qué requeriría el patrón A+C:

| Pieza | Estado actual | Requerido por diseño |
|-------|---------------|----------------------|
| MiniPay detection | ✅ `lib/minipay.ts`, `hooks/use-minipay.ts` | — |
| Address handling | ✅ wagmi/viem | — |
| Codename generator determinístico | ❌ no existe | NUEVO — pure function en `lib/identity/` |
| Pool de adjetivos+piezas i18n | ❌ no existe | NUEVO — `lib/content/identity-pool.ts` (EN/ES/PT) |
| Título contextual derivado de badges | ❌ no existe | NUEVO — derivar de hook `useBadges` ya existente |
| Account sheet showing alias | ⚠️ existe Account sheet; muestra qué exactamente — verificar | Cambio de display, no de data |
| Truncated address as secondary | ⚠️ verificar | Compliance MiniPay §1.3 |
| Locale-aware greeting | ✅ i18n catalogs en/es/pt ya activos | Reusar |

**Trabajo estimado para implementación (cuando se decida):**

- Codename generator + pool i18n: ~3h
- Wire into Account sheet + Hub greeting: ~2h
- Título contextual derivado: ~2h
- Tests vitest determinismo + i18n parity: ~1h
- VR refresh baselines surfaces tocadas: ~1h

Total ~9h, 1-2 sesiones. **No abrir ahora** — primero alinear el diseño con el grupo MiniPay+Celo.

---

## 7. Preguntas que vale la pena hacer al grupo MiniPay/Celo

(Aprovechando canal directo abierto:)

1. **"¿El alias app-local determinístico cumple §1.3 sin necesidad de input del usuario? ¿O requieren que el usuario lo pueda editar?"**
2. **"Para juego/gaming category, ¿es preferible alias temático (personaje) o username genérico estilo handle?"**
3. **"¿Hay algún API/header de MiniPay que exponga país o currency preference del usuario que no haya documentado en `minipay-guide.md`?"**
4. **"En apps live de gaming en MiniPay (Pixel Tycoon, etc.), ¿qué patrón de identidad usan? ¿Alias generado, custom, o phone resuelto?"**
5. **"Para Account/Profile screen — ¿prefieren ver address truncada como hint secundario o ocultarla totalmente?"**

---

## 8. Recomendación final

- **Decisión raíz confirmada:** no ODIS por ahora. Spec MiniPay lo permite.
- **Pattern A+C (codename determinístico + título contextual evolutivo)** maximiza tema chess, cero fricción, MiniPay-compliant.
- **No implementar todavía.** Esperar:
  1. Validación del patrón con el grupo MiniPay/Celo (preguntas §7).
  2. Confirmación de que Account sheet actual cumple §1.3 (verificar address display).
- **Cuando se implemente:** cluster ~1-2 sesiones, sin tocar contratos, sin tocar wallet flow. Pure presentation + content layer.
- **Patrón B (override editable)** queda como evolución futura si MiniPay lo pide o si el feedback de usuarios lo justifica.

---

## 10. Mensaje para el grupo MiniPay/Celo (ready to copy-paste)

> **Subject:** Chesscito — identity UX pattern validation before listing
>
> Hi team,
>
> Quick check before we lock identity UX for the readiness submission. Chesscito is a pre-chess learning game on Celo (Gaming category). We want to confirm we're reading §1.3 ("phone-first identity") the right way for a game.
>
> **Our intent (Pattern A+C):** skip ODIS entirely for now. Instead, generate a deterministic codename from the user's address (e.g. `"Golden Knight #2847"`) plus a contextual title that evolves with on-chain badges (e.g. `"Apprentice"` → `"Rook Master"` → `"PRO Strategist"`). The truncated `0x…` would appear only as a secondary hint inside the Account screen.
>
> Five questions to make sure we ship something you'll be happy to list:
>
> 1. Does an app-local deterministic alias satisfy §1.3 even without a user-editable input field?
> 2. For a gaming/education app, do you prefer a thematic alias like `"Golden Knight #2847"` or a generic username-style handle?
> 3. Does MiniPay expose any additional documented or undocumented signal for country, currency preference, or profile that we should be aware of? (We only see `isMiniPay`, address, chainId today.)
> 4. What identity pattern do other listed gaming Mini Apps use? Any examples you'd point us to as reference?
> 5. On the Account/Profile screen, do you prefer the truncated address shown as a secondary hint, or fully hidden?
>
> No rush on our side — we're not treating this as a blocker for the readiness form. We'll proceed with the rest of the submission and slot identity into a follow-up cluster once you confirm the pattern.
>
> Thanks!

---

## 9. Referencias

- `celopedia-skill / minipay-guide.md` §Phone Number → Address Resolution + §UI rule
- `celopedia-skill / minipay-requirements.md` §1.3 Phone-First Identity
- `celopedia-skill / odis-socialconnect.md` (descartado por decisión)
- Chesscito: `apps/web/src/lib/minipay.ts`, `apps/web/src/hooks/use-minipay.ts`, `apps/web/src/lib/server/wallet-detection.ts`
- Theme/character system: memory `theme-system-foundation` (KingdomAnchor, personajes piezas)
- Memory: `minipay-listing-safety` HARD RULE (no "MiniPay game" copy aún)
