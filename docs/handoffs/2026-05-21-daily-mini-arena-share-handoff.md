# Daily-Tactic + Mini-Arena Share Previews — Handoff (2026-05-21)

## Estado — SHIPPED to `main`

Cierra los items §3.1 (Daily-tactic share) y §3.2 (Mini-arena/endgame share) del handoff anterior (`docs/handoffs/2026-05-21-rich-share-previews-handoff.md`). Mismo patrón canonical-page-per-variant ya cementado por Phase 1+2+3 (`/share/score`, `/share/badge`).

Tests: **1824 passing** (baseline previo 1814 → +10; 5 daily + 5 endgame).

### Commits — daily-tactic (`3639cc52..f672542e`)

| SHA | Mensaje |
|---|---|
| `3639cc52` | feat(share): add shareUrlForDaily canonical URL builder |
| `1222c0a8` | feat(share): add /share/daily canonical page with rich OG metadata |
| `f672542e` | feat(share): wire canonical daily-tactic share URL through ShareModal |

### Commits — mini-arena/endgame (`f60018ce..9a16e8df`)

| SHA | Mensaje |
|---|---|
| `f60018ce` | feat(share): add shareUrlForEndgame canonical URL builder |
| `f3b336f5` | feat(share): add /share/endgame canonical page with rich OG metadata |
| `9a16e8df` | feat(share): wire canonical mini-arena share URL through ShareModal |

Pushed: `407efb30..9a16e8df` → `origin/main` (deploy auto).

---

## Lo que cambia para el usuario

**Antes:** compartir Daily-Tactic o mini-arena pegaba el URL crudo del PNG (`/api/og/exercise?...` o `/api/og/endgame?...`). El chat destino veía un `image/jpeg`, sin OG meta → preview genérica de Chesscito o, peor, ningún preview.

**Después:**
- Daily-Tactic → `https://www.chesscito.com/share/daily?piece=...&name=...&start=a1&target=h1[&solved=true&streak=N]`. Crawler lee OG → preview única por puzzle + outcome.
- Mini-arena → `https://www.chesscito.com/share/endgame?mode=krk&name=...&wk=...&wr=...&bk=...[&solved=true&moves=N&limit=N]`. Igual: preview única por posición + outcome.

Telegram/X/WhatsApp/Facebook lo ven todos.

---

## Decisiones registradas

1. **Namespace `endgame` (no `match`).** El handoff anterior tentativamente decía crear `/share/match/page.tsx`. Cambiado a `/share/endgame` por consistencia:
   - El endpoint OG ya es `/api/og/endgame` (krk mode).
   - El editorial es `ENDGAME_SHARE_COPY`.
   - `/api/og/match` es **otra cosa** (full-chess Arena vs AI — diferente surface).
   - Evita colisión semántica futura.
2. **Reutilizamos endpoints OG existentes.** `/api/og/exercise?type=daily` ya soportaba todos los params necesarios; igual `/api/og/endgame`. Cero cambios al render del PNG.
3. **Patrón canonical-page-per-variant.** Cada `/share/<variant>/page.tsx` normaliza+clampa sus propios params en `searchParams` y duplica esa normalización en el helper TypeScript. Hay dos sources of truth, intencionalmente:
   - Helper se ejecuta en el cliente al construir el URL antes de compartir.
   - Page server-component se ejecuta cuando un crawler hace el GET.
   Ambos deben sanitizar independientemente porque el helper podría tener bugs y el crawler podría recibir un URL fabricado externamente. La duplicación es cheap y defensiva.

---

## Smoke checklist (manual — pendiente post-deploy)

Una vez Vercel termine el deploy auto:

```bash
# Daily-Tactic
curl -s 'https://www.chesscito.com/share/daily?piece=rook&name=Test+Rook&start=a1&target=h1' \
  | grep -E 'og:image|twitter:card|robots' | head -4
# Esperado:
#   <meta property="og:image" content=".../api/og/exercise?type=daily&piece=rook&name=Test+Rook&start=a1&target=h1" />
#   <meta name="twitter:card" content="summary_large_image" />
#   <meta name="robots" content="noindex,nofollow" />

# Mini-arena endgame
curl -s 'https://www.chesscito.com/share/endgame?mode=krk&name=K%2BR+vs+K&wk=e1&wr=a1&bk=e8' \
  | grep -E 'og:image|twitter:card|robots' | head -4
```

Luego:

1. **X Card Validator** — https://cards-dev.twitter.com/validator
   - Pegar URLs de daily + endgame (solved + unsolved variants).
2. **Facebook Sharing Debugger** — https://developers.facebook.com/tools/debug/
   - Igual.
3. **WhatsApp** — chat propio, pegar link, esperar card.
4. **Telegram** — pegar en Saved Messages.
5. **MiniPay Android (device físico)** — flujo end-to-end: completar daily puzzle, abrir share, tap WhatsApp → confirmar preview en chat receptor. Idem mini-arena.

---

## Trabajo deferido (no bloquea ship)

Tomado del handoff anterior; estado actualizado:

### ~~1. Daily-tactic share~~ ✅ CLOSED hoy
### ~~2. Mini-arena (endgame) share~~ ✅ CLOSED hoy
### 3. Victory share (low prio — ya funciona)
Ya pasaba `url={shareUrl}` apuntando a `/victory/${id}`. Sin cambios.

### 4. Shop share (low prio)
`SHARE_COPY.shop(item)` usa `/api/og/invite` como cardUrl genérico. Si se quiere preview personalizada por item, crear `/share/shop?item=...`. Bajo impacto.

### 5. Telemetry validation (low prio)
Confirmar en producción que `share_tile_tap` registra eventos con `tile=telegram`. Si no, ajustar `telemetry.ts`.

### 6. Signed share URLs (deferred — v2)
Cualquiera puede compartir `/share/endgame?solved=true&moves=1&limit=1` y la preview rendereará "1/1". Para v2 considerar JWT corto firmado con server-side check. Para v1 es cosmético — no afecta on-chain state.

### 7. `/api/og/endgame` solo soporta `mode=krk`
El helper `shareUrlForEndgame` deja `mode` como tipo opcional `"krk"` para señalizar el future-proofing, pero hoy es el único mode soportado tanto en helper como en endpoint. Si llegan más modes (krp, kqk, etc.) será un add atómico en ambos lados.

---

## Archivos tocados

```
A apps/web/src/app/share/daily/page.tsx
A apps/web/src/app/share/endgame/page.tsx
M apps/web/src/components/daily/daily-tactic-sheet.tsx
M apps/web/src/components/daily/daily-tactic-slot.tsx
M apps/web/src/components/mini-arena/mini-arena-sheet.tsx
M apps/web/src/lib/og/__tests__/share-urls.test.ts
M apps/web/src/lib/og/share-urls.ts
```

---

## Open questions

1. ¿Capturar VR baselines para los nuevos `/share/daily` + `/share/endgame` landing pages? Sigue mismo criterio que `/share/score` + `/share/badge` cuando se shippearon — no se capturaron, son páginas estáticas mínimas con texto + CTA. Si se decide capturarlas, agregar a la lista del VR backlog.
2. **Métrica de éxito:** medir conversion `share-link → /share/* landing → /play-hub`. Requiere instrumentar `track("share_landing_view")` en cada page server-component (vía un client-component sentinel mounted on the landing). Pendiente si el equipo quiere ese funnel.
3. ¿Pre-warm de crawler cache después de cada solve? Probablemente no vale la pena: 3600s SWR + cache CDN absorben el costo (mismo razonamiento que score/badge).

---

## Próximo paso recomendado

1. Esperar deploy auto (~2 min) y correr smoke checklist arriba.
2. Validar en MiniPay Android real (queda en tu device).
3. Si OK, cerrar items §3.1 + §3.2 del handoff anterior como done. Este handoff los cubre.
4. Backlog: items #3 (Victory copy review), #4 (Shop per-item), #5 (telemetry), #6 (signed URLs v2).
