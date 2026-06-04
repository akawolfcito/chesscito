# Guía de testing — MiniPay zero-click (P0-4)

**Para:** Wolfcito, runtime testing en Android con MiniPay real
**Fecha:** 2026-06-03
**URL a probar:** `https://www.chesscito.com` (producción)
**Tiempo estimado:** 20-30 min con captura de evidencia

> Esta guía es la versión simplificada y accionable. El checklist técnico completo está en `docs/audits/2026-06-03-minipay-zero-click-runtime-checklist.md` (úsalo solo si quieres el detalle de cada criterio Pass/Fail).

---

## Antes de empezar (5 min)

1. Abre MiniPay en tu Android.
2. Anota en Notes/papel:
   - **Versión MiniPay** (Settings → About).
   - **Modelo Android + versión OS** (Settings → About phone).
   - **Saldo actual** (aunque sea dust).
3. Cierra todas las apps recientes (botón cuadrado → swipe-clear todo).
4. Mata MiniPay y vuélvela a abrir — esto da cold boot, importante para que la primera medición no esté contaminada.
5. (Opcional, si tienes laptop con USB) Activa **Developer Options → USB debugging** en el Android. Conecta al laptop. Abre `chrome://inspect` en Chrome desktop. Si ves el WebView de MiniPay listado, vas a poder leer la consola en tiempo real. Si no, no pasa nada — los screenshots alcanzan.

---

## Qué estás validando

**Una sola pregunta:** ¿se conecta la wallet sola, sin que tengas que tocar "Connect Wallet"?

Todo lo demás es contexto. Si tienes que tocar un botón para conectarte → **FAIL**. Si la app ya sabe quién eres apenas abres el link → **PASS**.

---

## Los 6 pasos

Hazlos en orden, en una sola corrida. Captura screenshot **al final de cada paso**.

### Paso 1 — Abrir la URL en MiniPay

- Abre MiniPay → busca el navegador interno (suele estar en Discover, Apps, o ícono globo).
- Pega `https://www.chesscito.com` y entra.
- **Observa:** ¿carga la landing? ¿se ve completa, sin scroll horizontal, layout móvil correcto?
- **Cronometra mentalmente:** ¿tardó <3s en pintar algo?

📸 Screenshot 1: landing visible.

**Resultado posible:**
- ✅ PASS si la landing se pinta limpia.
- ❌ FAIL si: pantalla blanca >5s, error de cert/SSL, "No se puede acceder al sitio", overflow horizontal.

---

### Paso 2 — ¿Reconoce que es MiniPay?

Esto es lo más sutil. Mira la landing buscando alguna señal de que la app ya sabe que estás en MiniPay:

- ¿Aparece algún chip/badge tipo "MiniPay detected"?
- ¿La CTA principal cambia respecto a abrir la URL en Chrome normal?
- ¿Hay algún elemento de "Welcome back" o saludo personalizado?

Si tienes Chrome remote debugging activo: abre la consola del WebView y escribe:
```
window.ethereum
window.ethereum?.isMiniPay
```
Esperado: el segundo devuelve `true`.

📸 Screenshot 2: landing con cualquier indicador MiniPay (si lo hay).

**Resultado posible:**
- ✅ PASS si hay algún signal visible o `isMiniPay === true` en consola.
- 🟡 PARTIAL si no hay UI signal pero la consola confirma detección.
- ❌ FAIL si nada indica detección y la app trata MiniPay como navegador genérico.

---

### Paso 3 — ¿Te lleva sola a /hub?

Sin tocar nada (espera ~3-5s desde la landing):

- ¿La app te lleva sola a `/hub`?
- O ¿tienes que tocar una CTA principal para entrar?

📸 Screenshot 3: pantalla `/hub` o landing-con-CTA-armada según el caso.

**Resultado posible:**
- ✅ PASS si te lleva sola a `/hub` sin tap.
- 🟡 PARTIAL si tienes que dar 1 tap a la CTA y eso te mete a `/hub` directo (sin pasar por wallet-connect).
- ❌ FAIL si aparece modal de wallet/connect antes de llegar al hub.

> Nota: PARTIAL es aceptable para el listing si el tap es UI-natural (CTA grande "Play"). Lo importante es que NO haya modal de wallet en medio.

---

### Paso 4 — `/hub` SIN "Connect Wallet"

Ya en `/hub`, mira con cuidado el HUD superior y todos los elementos visibles:

- ¿Ves botón/chip que diga "Connect Wallet", "Connect", "Login", "Sign in"?
- ¿O ya ves tu dirección truncada (tipo `0x1234...abcd`) o un avatar/badge?
- ¿El tablero/tile rail (Kingdom, daily tile) carga normal o queda en skeleton?

📸 Screenshot 4: `/hub` completo, scroll vertical si hace falta para mostrar HUD + rail.

**Resultado posible:**
- ✅ PASS si hay dirección/avatar visible y CERO mención de "Connect".
- 🟡 PARTIAL si hay address visible pero también un botón "Disconnect" o similar (no es problema, solo nota).
- ❌ FAIL si ves "Connect Wallet" en cualquier parte del HUD.

---

### Paso 5 — Account/Profile confirma la wallet

- Toca el ícono de cuenta/perfil del HUD (suele estar arriba a la derecha o en el dock).
- Se abre un sheet/bottom-modal.
- Busca tu address ahí.

📸 Screenshot 5: sheet de account con dirección visible (puedes tapar el address con dedo si te incomoda, pero deja claro que SÍ está poblada).

**Resultado posible:**
- ✅ PASS si address presente y consistente con tu MiniPay wallet.
- ❌ FAIL si el sheet muestra "Connect to see your profile" o equivalente.

---

### Paso 6 — Una superficie que lee balance funciona

- Cierra el account sheet.
- Abre **Shop** (o cualquier tile que muestre precios/saldos: la tienda lee balance para mostrar pricing).
- Espera ~5-10s a que cargue.

📸 Screenshot 6: Shop con pricing visible y NO "loading..." infinito.

**Resultado posible:**
- ✅ PASS si ves precios renderizados (no skeleton ni "—").
- 🟡 PARTIAL si los precios cargan pero notas un toast de error después que desaparece.
- ❌ FAIL si Shop queda en loading >15s o muestra error persistente.

> **NO** intentes comprar nada. NO hagas mint. Validamos solo lectura.

---

## Si todo es PASS

P0-4 cierra. Me pasas los 6 screenshots + las notas (versión MiniPay, modelo, OS, address-prefijo opcional) y yo armo:

1. `docs/audits/2026-06-03-minipay-zero-click-runtime-results.md` (results doc).
2. Commit `docs(audits): record MiniPay zero-click runtime P0-4 results`.
3. Actualizo MEMORY.md (`minipay-zero-click-p0-4-pass-2026-06-03`).
4. MiniPay readiness pasa 6/9 → 7/9.

## Si algo es FAIL o PARTIAL

Anota textualmente qué viste (no interpretes). Ejemplo:
> Paso 4: HUD muestra chip "Connect Wallet" en esquina superior izquierda + texto "Conecta tu wallet para empezar".

Me pasas eso + el screenshot. Abro spec de cluster nuevo para corregir la falla (no toco código en esta sesión).

---

## Anexo opcional — iOS smoke

Si después de Android quieres validar iOS:

1. Abre **Opera browser** o Safari en iOS.
2. Pega `https://www.chesscito.com`.
3. Verifica solo cosas visuales: la landing pinta, no hay overflow, las animaciones no se rompen.
4. **NO** hay zero-click esperado en iOS — eso requiere MiniPay app Android o equivalente.
5. Si algo se ve roto, screenshot + nota.

iOS NO bloquea P0-4. Es nota al pie en el results doc.

---

## Resumen TL;DR

| Paso | Qué validas | Tiempo |
|---|---|---|
| 0 | Pre-flight: versión MiniPay, modelo, cold boot | 5 min |
| 1 | URL carga limpia en MiniPay WebView | 1 min |
| 2 | App detecta que es MiniPay | 1 min |
| 3 | Auto-route o single-tap CTA → `/hub` | 2 min |
| 4 | `/hub` SIN "Connect Wallet" visible | 2 min |
| 5 | Account sheet muestra wallet address | 2 min |
| 6 | Shop lee precios reales (balance funciona) | 3 min |
| iOS | Smoke visual opcional | 5 min |

**Total: ~20 min Android + 5 min iOS opcional.**

Listo cuando me digas, te espero los screenshots para armar el results doc.
