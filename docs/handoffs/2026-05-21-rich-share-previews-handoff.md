# Rich Share Previews — Handoff (2026-05-21)

## Estado

Phase 1+2+3 del spec `docs/superpowers/specs/2026-05-21-rich-share-previews-design.md` shipped a `main`. Tests: **1813 passing** (baseline 1765 → +48; 14 directos de este trabajo).

### Commits

| SHA | Mensaje |
|---|---|
| `067ba394` | docs(spec): add rich share previews design |
| `41da68f4` | feat(og): add canonical share URL helpers |
| `f6d9701c` | feat(share): add /share/score and /share/badge canonical pages |
| `ecea5fd6` | feat(share): wire canonical share URL through result-overlay |
| `9be01002` | feat(share): replace Messages (SMS) with Telegram tile |

### Lo que cambia para el usuario

**Antes:** compartir score/badge ponía `https://chesscito.com` pelado. WhatsApp/X/Telegram leían el OG genérico del root y mostraban siempre el mismo card de "Pequeñas jugadas. Grandes hábitos…".

**Después:**
- Compartir score → `https://chesscito.com/share/score?piece=rook&stars=9`. WhatsApp/X/Telegram leen el OG de esa página → `og:image = /api/og/exercise?piece=rook&stars=9&type=piece-complete` → preview única por pieza + estrellas.
- Compartir badge → `https://chesscito.com/share/badge?piece=...&stars=...` → preview tipo "BADGE UNLOCKED" del PNG dinámico.
- Tile **Telegram** reemplaza a Messages (SMS). WhatsApp / Telegram / X / Facebook / Save / More.

### Lo que NO cambió (decisiones registradas)

- **No se agregaron tiles directos de Instagram ni TikTok.** Ambos strippean OG previews y no tienen API pública de share-via-URL. Pretender lo contrario engañaría al usuario. La ruta real para IG/TikTok es **Save → upload manual a Story/Reel/Post**.
- **Save/More no se refactorizó.** El código actual ya los diferencia:
  - Save: `navigator.share({ files, text })` — imagen sin URL.
  - More: `navigator.share({ files, text, url })` — imagen + URL para que el canvas receptor renderee el preview rico.
  Forzar `<a download>` en Save (idea original del spec) arriesga regresión en MiniPay Android donde el archivo no siempre aparece en Photos. El comportamiento actual es preferible.

---

## Smoke checklist (manual — pendiente)

Una vez deployado a producción:

1. **X Card Validator** — https://cards-dev.twitter.com/validator
   - Pegar `https://chesscito.com/share/score?piece=rook&stars=9` → debe mostrar el PNG de Rook Mastered 9/15.
   - Pegar `https://chesscito.com/share/badge?piece=bishop&stars=15` → debe mostrar PNG Bishop Ascendant 15/15.
2. **Facebook Sharing Debugger** — https://developers.facebook.com/tools/debug/
   - Igual: probar 2-3 variantes (rook 9, bishop 12, knight 5).
3. **WhatsApp** — abrir un chat propio, pegar el link, esperar la card preview.
4. **Telegram** — pegar el link en Saved Messages. Si no aparece preview, pegar otra vez para forzar refresh del bot cache.
5. **MiniPay WebView (Android)** — completar un ejercicio, abrir el share, tap WhatsApp → confirmar preview en el chat.

**Pre-warm tip:** la primera vez que un link nuevo se comparte, el bot de la red social cachea el OG. Si el render del PNG tarda >3s en el primer hit, el bot puede dejar el preview "sin imagen" hasta el segundo intento. Mitigación: GET manual al `/api/og/exercise?...` antes de pegar el link, o usar el debugger oficial de cada red que fuerza re-fetch.

---

## Trabajo deferido (no bloquea ship)

### 1. Daily-tactic share (medium prio)
`apps/web/src/components/daily/daily-tactic-sheet.tsx:206` llama `<ShareModal>` sin `url=`. Aplicar mismo patrón:
- Crear `/share/daily/page.tsx` con `generateMetadata` apuntando a `/api/og/exercise?type=daily&...`.
- Agregar `shareUrlForDaily(...)` a `share-urls.ts`.
- Wire en `daily-tactic-sheet.tsx`.

Estimado: 2-3h.

### 2. Mini-arena (endgame) share (medium prio)
`apps/web/src/components/mini-arena/mini-arena-sheet.tsx:555` mismo gap.
- Necesita decidir si reutilizar `/api/og/endgame` o crear nueva variante.
- Crear `/share/match/page.tsx`.
- Wire.

Estimado: 2-3h.

### 3. Victory share (low prio — ya funciona)
`apps/web/src/components/arena/victory-claim-success.tsx:177` ya pasa `url={shareUrl}` apuntando a `/victory/${id}` que ya tiene su propio `generateMetadata`. **Ya funcionaba antes de este trabajo** — no requiere cambios.

### 4. Shop share (low prio)
`SHARE_COPY.shop(item)` usa `/api/og/invite` como cardUrl genérico. Si se quiere personalizado por item, crear `/share/shop?item=...`. Bajo impacto.

### 5. Telemetry validation (low prio)
Confirmar en producción que `share_tile_tap` registra eventos con `tile=telegram`. Si no, ajustar `telemetry.ts` para incluir nuevo tile key.

### 6. Signed share URLs (deferred — v2)
Cualquiera puede compartir `/share/score?stars=999` y la preview rendereará 15/15 sin validar. Para v2 considerar JWT corto firmado con server-side check. Para v1 es cosmético — no afecta on-chain state.

---

## Verificación rápida (después de deploy)

```bash
# OG metadata en HTML
curl -s 'https://chesscito.com/share/score?piece=rook&stars=9' \
  | grep -E 'og:image|twitter:card|robots'

# Esperado:
#   <meta property="og:image" content="https://chesscito.com/api/og/exercise?..." />
#   <meta name="twitter:card" content="summary_large_image" />
#   <meta name="robots" content="noindex,nofollow" />

# PNG render
curl -sI 'https://chesscito.com/api/og/exercise?piece=rook&stars=9&type=piece-complete' \
  | head -5
# Esperado: 200, Content-Type: image/jpeg, Cache-Control con s-maxage=3600
```

---

## Open questions

1. **Pre-warm de crawler cache** después de cada mint/badge — ¿vale la pena un `waitUntil()` que toque el OG endpoint o lo dejamos al primer share-tap del usuario? (Probablemente no vale la pena: 3600s SWR + cache CDN absorben el costo.)
2. **¿Falla la preview en MiniPay WebView?** Por arquitectura debería funcionar (la preview la rendea el chat de destino, no el WebView), pero confirmar en QA.
3. **Métrica de éxito:** ¿cómo medimos que más clicks llegan a chesscito.com por shares con preview rica? Telemetry `share_tile_tap` ya cuenta taps, pero el conversion downstream (link → /share/score → /play-hub) requiere instrumentar la página `/share/*` con un `track("share_landing_view")`. Pendiente si el equipo quiere ese funnel.

---

## Archivos tocados

```
A apps/web/src/app/share/badge/page.tsx
A apps/web/src/app/share/score/page.tsx
A apps/web/src/components/share/__tests__/share-grid.test.tsx
M apps/web/src/components/share/share-grid.tsx
M apps/web/src/components/exercises/result-overlay.tsx
A apps/web/src/lib/og/__tests__/share-urls.test.ts
A apps/web/src/lib/og/share-urls.ts
A docs/superpowers/specs/2026-05-21-rich-share-previews-design.md
```

---

## Próximo paso recomendado

1. Deploy a preview → ejecutar smoke checklist.
2. Si OK, promote a `chesscito.com` y validar en MiniPay Android real.
3. Decidir si abordar daily-tactic + mini-arena share en sprint actual o backlog.
