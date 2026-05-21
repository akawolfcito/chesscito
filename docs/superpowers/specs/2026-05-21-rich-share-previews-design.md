# Rich Share Previews — Design Spec

**Status:** approved (2026-05-21)
**Date:** 2026-05-21
**Author:** Senior expert review (Wolfcito + Sally)
**Owner:** Frontend / Sharing

**Decisiones aprobadas:**
- ✅ Telegram **reemplaza** Messages (SMS) en el share grid.
- ✅ Save se mantiene como canal real para IG/TikTok (label "Save").
- ✅ NO se agregan tiles directos de Instagram ni TikTok (no soportan link preview ni share-via-URL API). El usuario aceptó esta limitación técnica.

---

## 1. Diagnóstico — por qué hoy no hay preview

Síntoma (Image #1 de X): el share del score muestra solo texto + dominio. Cero preview rica. Mismo comportamiento en WhatsApp, Telegram, Facebook, X.

**Causa raíz:** la URL compartida es `https://chesscito.com` (root). Los crawlers de cada red (Twitterbot, WhatsApp link preview bot, etc.) hacen GET a esa URL, leen los OG tags genéricos del layout y renderizan el card también genérico (Image #1: "Pequeñas jugadas. Grandes hábitos…").

**La infraestructura YA existe:**
- 5 endpoints OG dinámicos: `/api/og/{exercise,endgame,match,invite,victory/[id]}` (renderean PNG via `ImageResponse`).
- `ShareModal` ya muestra preview local del PNG.
- `ShareGrid` ya soporta `cardUrl` y lo adjunta como `File` en `navigator.share({ files })` para IG/TikTok via Save.

**El gap:** los endpoints OG están desconectados del `og:image` meta tag de las URLs que se comparten. El `cardUrl` se usa para Save (file attach) pero la `url` que se envía a WhatsApp/X/Telegram es `chesscito.com` pelado, no una URL canónica que apunte al PNG.

**Fingerprint del bug:**
- `apps/web/src/components/exercises/result-overlay.tsx:185` → genera `text = SHARE_COPY.score(stars)`
- `apps/web/src/components/exercises/result-overlay.tsx:213` → genera `cardUrl = /api/og/exercise?piece=...&stars=...`
- `apps/web/src/components/share/share-grid.tsx:43` → `shareUrl = url ?? SHARE_COPY.url` → cae a `chesscito.com` porque nadie pasa `url`.
- Resultado: WhatsApp/X/Telegram reciben `text + chesscito.com`. Crawler no encuentra el PNG dinámico.

---

## 2. Realidad de canales sociales (ground truth)

| Canal | Link Preview (OG) | Share-via-URL API | File Upload (PNG) |
|---|---|---|---|
| WhatsApp | ✅ Sí | ✅ `wa.me/?text=` | ✅ Web Share L2 files |
| Telegram | ✅ Sí | ✅ `t.me/share/url?url=` | ✅ Web Share L2 files |
| X / Twitter | ✅ Sí (`summary_large_image`) | ✅ `x.com/intent/tweet` | ✅ Web Share L2 files |
| Facebook | ✅ Sí | ✅ `facebook.com/sharer` | ✅ Web Share L2 files |
| iMessage / SMS | ✅ Sí | ✅ `sms:` (con costo) | ✅ Web Share L2 files |
| Discord | ✅ Sí | ❌ (deep-link a app) | ✅ Web Share L2 files |
| LinkedIn | ✅ Sí | ✅ `linkedin.com/sharing` | ✅ Web Share L2 files |
| **Instagram** | ❌ **Strippea OG** | ❌ **No existe API pública de URL share** | ⚠️ Solo via Stories deep-link (app instalada + Facebook App ID registrado) |
| **TikTok** | ❌ **Strippea OG** | ❌ **No existe API pública** | ⚠️ Solo upload manual |

**Conclusión dura:** IG y TikTok NO son canales válidos para "link preview". Pretender que un botón `Instagram` en el share grid abra IG con preview es ingenieríamente imposible — IG no acepta links con preview ni en feed ni en DM ni en bio.

**Lo que sí funciona para IG/TikTok:** generar la imagen y dejar que el usuario la suba manualmente (Stories/Reel/Post). Eso es exactamente lo que hace **Save** hoy.

→ **Save NO es redundante con More.** Save = canal real para IG/TikTok (PNG en cámara/galería). More = OS share-sheet (incluye apps que sí aceptan link, como Telegram nativo, Slack, etc.). Fusionarlos pierde el canal IG/TikTok.

---

## 3. Estrategia recomendada

### 3a. Resolver previews ricas (P0 — núcleo del problema)

Crear página canónica per-share:

```
/share/[variant]/[...params]
  ↓ generateMetadata() lee params
  ↓ exporta og:image = /api/og/exercise?... (absoluta)
  ↓ exporta twitter:card = "summary_large_image"
  ↓ body redirige a /play-hub o landing
```

**Variantes iniciales:**
- `/share/score?piece=rook&stars=9` → OG = `/api/og/exercise?piece=rook&stars=9&type=piece-complete`
- `/share/badge?piece=rook&stars=15` → OG = `/api/og/exercise?piece=rook&stars=15&type=badge-earned`
- `/share/victory/[id]` → ya existe parcialmente (`/api/og/victory/[id]`)
- `/share/match?...` → para mini-arena

**ShareGrid recibe la URL canónica:**
```tsx
<ShareModal
  cardUrl="/api/og/exercise?piece=rook&stars=9&type=piece-complete"
  text={SHARE_COPY.score(9)}
  url="https://chesscito.com/share/score?piece=rook&stars=9"  // ← nuevo
/>
```

Resultado: WhatsApp/X/Telegram hacen GET a `/share/score?...`, leen OG, renderean el PNG dinámico. Cada compartida es visualmente única.

**Crawler-safe:** la página `/share/...` debe responder HTML estático (SSR) con OG tags hardcodeados para esos params. Evitar redirects 3xx antes de que el bot lea el `<head>`.

### 3b. Re-pensar el share grid (P1 — UX)

**Antes (hoy):** WhatsApp · Messages · Facebook · X · Save · More (6 tiles)

**Después (propuesto):** WhatsApp · Telegram · X · Facebook · Save · More (6 tiles)

**Cambios:**
- ❌ **Quitar Messages (SMS)** — válido: nadie comparte por SMS hoy, tiene costo en muchos países.
- ✅ **Agregar Telegram** — `t.me/share/url?url=...&text=...`. Renderiza OG perfectamente. Muy usado en cripto/MiniPay/Celo.
- ❌ **NO agregar Instagram ni TikTok como tiles directos** — engañoso, no hay API pública. Su flujo real es Save → galería → upload manual.
- ✅ **Mantener Save** — único camino a IG/TikTok/Stories/Reels. NO fusionar con More.
- ✅ **Mantener More** — share-sheet OS captura todo lo demás (Discord, Slack, LinkedIn, Telegram nativo si no usan el tile, etc.).

**Argumento contra "Instagram" tile (importante para el usuario):** el usuario propuso reemplazar Messages por Instagram porque "es más concurrida". Reality check senior: aunque IG sea más concurrido, **un botón `Instagram` en el share grid no puede entregar lo que el usuario espera** (preview rica). Lo máximo que puede hacer es abrir IG vacío o copiar al portapapeles — UX pobre. La estrategia correcta para IG es **Save → user sube como Story/Reel/Post manual**. Educar al usuario con label tipo "Save (for IG / TikTok)" es más honesto.

### 3c. Save vs More — clarificar (P2)

Hoy:
- Save: descarga PNG si Web Share L2 no está, o usa `navigator.share({ files })` si sí está.
- More: abre OS share sheet con `navigator.share({ text, url })` y, si hay `cardUrl`, también con `{ files }`.

**Overlap real:** sí lo hay cuando Web Share L2 con files está disponible — ambos llaman `navigator.share({ files })`. La diferencia útil:
- **Save** → intención explícita: "quiero el PNG en mi galería" (para IG/TikTok). Label podría ser "Save image" o "Save for IG".
- **More** → intención: "quiero el OS picker para elegir un canal" (Discord, Slack, etc.).

**Recomendación:** mantener ambos pero diferenciar UX:
- Save: forzar `<a download>` PRIMERO (no native share). El PNG queda en Photos/Gallery sí o sí. El usuario abre IG/TikTok manualmente.
- More: navigator.share clásico con text+url (no files necesariamente — depende del canal del OS picker).

Esto elimina el solape conceptual: Save = archivo en disco. More = OS picker.

---

## 4. Plan de implementación — 4 fases

### Fase 1 — Página canónica `/share/[variant]` (P0)
**Archivos:**
- `apps/web/src/app/share/score/page.tsx` (nuevo) — `generateMetadata` lee `searchParams.piece + stars`, exporta OG absoluto.
- `apps/web/src/app/share/badge/page.tsx` (nuevo) — idem.
- `apps/web/src/app/share/match/page.tsx` (nuevo) — para mini-arena.
- `apps/web/src/lib/og/share-urls.ts` (nuevo) — helpers `shareUrlForScore({ piece, stars })`, `shareUrlForBadge(...)`, etc. Validan params, devuelven URL absoluta.

**Tests (Vitest):**
- `share-urls.test.ts`: 6 specs para validar params + URL output.
- E2E smoke: GET `/share/score?piece=rook&stars=9` → HTML contiene `<meta property="og:image" content="https://chesscito.com/api/og/exercise?..." />` y `<meta name="twitter:card" content="summary_large_image">`.

### Fase 2 — Wire-up del share grid (P0)
**Archivos:**
- `apps/web/src/components/exercises/result-overlay.tsx:225,380` — agregar prop `url={shareUrlForScore(...)}` al `<ShareModal>`.
- `apps/web/src/components/arena/victory-claim-success.tsx:172` — `url={shareUrlForVictory(id)}`.
- `apps/web/src/components/arena/victory-celebration.tsx` — idem.
- `apps/web/src/components/daily/daily-tactic-sheet.tsx:206` — `url={shareUrlForDaily(...)}`.
- `apps/web/src/components/mini-arena/mini-arena-sheet.tsx:555` — `url={shareUrlForMatch(...)}`.

**Tests:**
- Update existentes que pasen `url` (mock canSare / navigator.share).

### Fase 3 — Share grid revamp (P1)
**Archivos:**
- `apps/web/src/components/share/share-grid.tsx` — quitar SMS tile, agregar Telegram tile (`href=https://t.me/share/url?url=${shareUrl}&text=${text}`).
- `apps/web/src/lib/content/editorial.ts` — agregar `SHARE_COPY.labels.telegram = "Telegram"`, `saveForSocial = "Save"` (o mejor copy).

**Tests:**
- Vitest: 6 tiles renderizados, Telegram href correcto.

### Fase 4 — Diferenciar Save / More (P2)
**Archivos:**
- `apps/web/src/components/share/share-grid.tsx` — Save: forzar `<a download>` (skip `navigator.share`). More: usar `navigator.share({ text, url })`.
- Update telemetry events para tracking limpio (`share_tile_tap` con `tile=save_download` vs `tile=more_native`).

**Tests:**
- Vitest: Save dispara download anchor, More dispara navigator.share.

---

## 5. Validación end-to-end

Después de cada fase, verificar con bot oficial de cada red:

1. **X Card Validator** — https://cards-dev.twitter.com/validator
2. **Facebook Sharing Debugger** — https://developers.facebook.com/tools/debug/
3. **WhatsApp** — compartir el link a uno mismo, ver preview en chat.
4. **Telegram** — Telegram strippea cache rápido, basta con compartir y volver a abrir.
5. **LinkedIn Post Inspector** — https://www.linkedin.com/post-inspector/

**Smoke checklist:**
- [ ] `chesscito.com/share/score?piece=rook&stars=9` muestra preview con torre + 9★.
- [ ] `chesscito.com/share/score?piece=bishop&stars=12` muestra preview con alfil + 12★ (distinta a la anterior).
- [ ] `chesscito.com/share/badge?piece=rook&stars=15` muestra preview de badge ascendant rook.
- [ ] En MiniPay WebView Android, tap "WhatsApp" → preview aparece en WA chat.

---

## 6. Tradeoffs y riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Crawler cache de redes — primer compartida puede tardar minutos en mostrar preview | Alto | Pre-warm: GET a `/share/...` desde server después de generar el share; usar X/FB debugger una vez por variante. |
| `/share/[variant]` indexable en Google → puede contaminar SEO con miles de URLs paramétricas | Medio | `robots.txt` excluye `/share/`; `<meta name="robots" content="noindex">` en `generateMetadata`. |
| Crawlers no ejecutan JS → si la página depende de client render, OG no llega | Bajo | Forzar SSR; OG en `generateMetadata` (server). Validar con cURL. |
| ImageResponse render lento (>3s) → crawlers timeout | Bajo | Mantener PNGs simples; medir P95; agregar `revalidate` (CDN cache). |
| Usuario espera "Instagram" tile real | Medio | Educar con label honesto: "Save for IG / TikTok". Documentar en help. |
| Cambiar Messages por Telegram puede romper UX para usuarios que dependían de SMS | Bajo | Telemetry actual de `share_tile_tap` debería confirmar uso bajo de SMS antes de quitar. |

---

## 7. Open questions

1. **¿Compartir el `cardUrl` con un token firmado?** (para evitar manipulación: cualquiera podría compartir `/share/score?stars=999`). Para v1 acepto que es cosmético; para v2 considerar JWT corto en URL.
2. **`/share/victory/[id]`** ya existe → ¿reutilizar o crear `/share/score` separado? Recomendación: separado, porque victory ID viene de NFT mint (on-chain proof), score es client-side stars.
3. **Pre-warm de crawler cache** después de un mint → opcional, P2.
4. **Métrica de éxito:** ¿telemetría de "share_tile_tap" con preview rica vs sin? Hard de medir client-side. Proxy: comparar `share_modal_open` vs flujo de invite landings (`/?ref=...`).

---

## 8. Estimación

- Fase 1 (página canónica + helpers + tests): 4-6h
- Fase 2 (wire-up 5 call sites): 2-3h
- Fase 3 (grid revamp + Telegram): 2h
- Fase 4 (Save/More refactor): 1-2h
- Validación end-to-end + smoke: 1-2h

**Total: ~10-15h focused work. Sugerido shipear Fase 1+2 primero (unblock preview rica), Fase 3+4 después (UX polish).**

---

## 9. Decisiones del owner — CERRADAS

- [x] Spec aprobado 2026-05-21
- [x] Telegram **reemplaza** Messages.
- [x] Save se mantiene para IG/TikTok.
- [x] Label "Save" (sin sufijo "for IG").
