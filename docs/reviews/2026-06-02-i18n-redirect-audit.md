# i18n Redirect Audit — Serve Default Locale From Root

**Fecha:** 2026-06-02
**Scope:** auditoría read-only. No se modifica código.
**Objetivo:** eliminar el 307 `/ → /en` y `/hub → /en/hub` documentado en `docs/pagespeed-report-2026-06-02.md` (3.5 s mobile / ~11 s desktop por visita).

---

## 1. Diagnóstico corto del routing actual

- **next-intl 4.12.0** con `defineRouting({ localePrefix: "always" })` en `apps/web/src/i18n/routing.ts:21`.
- **Toda la app vive bajo `app/[locale]/...`** — no existe ningún `app/page.tsx` ni `app/<route>/page.tsx` en la raíz. La única manera de renderizar una página es vía `/en/<path>` o `/es/<path>` (no hay alternativa en disco).
- El middleware `apps/web/src/middleware.ts` instancia next-intl con la misma config y, además, fuerza un 307 explícito de `/es/*` → `/en/*` cuando `NEXT_PUBLIC_I18N_ES_READY !== "1"` (estado actual en producción).
- Resultado en producción para un usuario MiniPay que abre `https://www.chesscito.com`:
  1. **Hop 1 (next-intl middleware):** `/` → 307 → `/en`.
  2. `app/[locale]/page.tsx:33-38` detecta el UA del wallet → `redirect("/hub")` (bare path, sin locale).
  3. **Hop 2 (next-intl middleware):** `/hub` → 307 → `/en/hub`.
  4. Renderiza el hub.
  Hasta tres saltos por entrada al app. Lighthouse `redirects` audit lo cuantifica en 3553 ms mobile / 10935 ms desktop.

- **Internal-links discipline está rota a medias:**
  - Solo 5 archivos importan de `@/i18n/navigation`: `share/badge/page.tsx`, `share/score/page.tsx`, `share/daily/page.tsx`, `coach/[gameId]/coach-game-client.tsx`, `coach/history/page.tsx`.
  - 20 archivos importan de `next/link` o `next/navigation` y emiten paths bare (`href="/hub"`, `href="/arena?fresh=1"`, `href="/privacy"`, etc.).
  - **Esto resulta neutral con `localePrefix: "always"`** (todos los bare paths sufren 307 al `/en/...`).
  - **Es una ventaja con `localePrefix: "as-needed"`**: los bare paths del EN render directo, sin redirect.

- **Sitemap + canonical**: `app/sitemap.ts` lista `/` como canonical + cada `/<locale>/<path>`. `app/[locale]/layout.tsx:43-55` declara `alternates.languages = { en: '/en', es: '/es', 'x-default': '/en' }`. Ambos asumen el modelo `always`. Necesitan ajuste recíproco.

- **`BASE_URL` desactualizado**: dos sitios (`sitemap.ts:16` y `[locale]/layout.tsx:33`) caen a `https://chesscito.com` (apex sin `www`) cuando `NEXT_PUBLIC_APP_URL` está vacío. Stale per la migración del commit 1. **No es bloqueante para este audit** (en producción el env está seteado, y el commit 1 ya actualizó el comentario template), pero conviene corregir el default mientras tocamos los archivos.

---

## 2. Archivos involucrados

| Archivo | Rol | Cambio requerido |
|---|---|---|
| `apps/web/src/i18n/routing.ts` | source-of-truth de la routing config | `localePrefix: "always"` → `"as-needed"` |
| `apps/web/src/middleware.ts` | runtime que aplica el redirect | Mismo flip en la config duplicada (ES_READY=false branch) + ajustar el regex `/^\/es/` para que apunte a bare path en vez de `/en` |
| `apps/web/src/app/sitemap.ts` | indexable URLs + hreflang | EN URLs sin prefix; ES URLs con `/es/`; canonical `x-default` apunta a EN unprefixed; default `BASE_URL` a `www.chesscito.com` |
| `apps/web/src/app/[locale]/layout.tsx` | metadata + alternates | `alternates.languages` → `{ en: '/', es: '/es', 'x-default': '/' }`; default `BASE_URL` a `www.chesscito.com` |
| `apps/web/src/i18n/navigation.ts` | client navigation primitives | **Sin cambios** — la API expuesta no cambia |
| `apps/web/src/i18n/request.ts` | per-request next-intl config | **Sin cambios** |
| `app/[locale]/page.tsx:37` | landing → hub redirect (UA-based) | **Sin cambios obligatorios** — `redirect("/hub")` sigue funcionando porque `/hub` ya es la URL canónica EN bajo `as-needed`. Mejora opcional posterior: pasarlo por `getPathname` de `@/i18n/navigation` para ser locale-aware si llega a haber tráfico ES. |

**No tocar** (per scope del audit): contratos, payment-token, copy, identity, low-balance, stats, apps/video, Labyrinth Badges, ningún componente de producto.

---

## 3. Por qué ocurre el 307 (explicación causal)

next-intl 4.x con `localePrefix: "always"`:

1. El middleware (`createMiddleware(routing)`) intercepta TODO request que cae bajo el matcher (`/((?!api|_next|_vercel|dev|.*\..*).*)`).
2. Para cada request, evalúa: "¿el pathname empieza con uno de los `locales` configurados?" (`/en/...`, `/es/...`).
3. Si NO, decide el locale óptimo:
   - Cookie `NEXT_LOCALE` si existe.
   - Si no, `Accept-Language` header negociado contra la lista de `locales`.
   - Si no, `defaultLocale` (`en`).
4. Emite un **307 Temporary Redirect** al pathname prefixado: `/hub` → `/en/hub`.
5. El browser sigue el redirect y carga `/en/hub`, que matchea `app/[locale]/hub/page.tsx` con `params.locale = "en"`.

Con `localePrefix: "as-needed"`:

1. Mismo intercept del middleware.
2. Para el default locale (EN), el middleware **NO redirige**: hace un **rewrite interno** de `/hub` → `/en/hub` (renderiza el mismo archivo del disco, pero la URL pública sigue siendo `/hub`).
3. Para non-default locales (ES), mantiene el comportamiento: emite el prefix (`/es/hub`).
4. Si llega un request a `/en/hub` (legacy), next-intl emite un 307 a `/hub` (canonicaliza la default locale a URL bare). One-time cost para bookmarks antiguos; los crawlers acaban indexando el canonical bare.

Eso elimina el 307 del default-locale traffic — el 99% del tráfico hoy (ES_READY=false).

---

## 4. Patch propuesto

### 4.1 `apps/web/src/i18n/routing.ts`

```diff
 export const routing = defineRouting({
   locales: ["en", "es"],
   defaultLocale: "en",
-  localePrefix: "always",
+  localePrefix: "as-needed",
   localeDetection: true,
 });
```

También: actualizar el JSDoc de los bullets 3 (línea 12-13) para reflejar el nuevo comportamiento. Cambio cosmético, mismo commit.

### 4.2 `apps/web/src/middleware.ts`

Dos cambios:

**(a)** Flip del `localePrefix` en la config duplicada (branch ES_READY=false):

```diff
   const intlMiddleware = ES_READY
     ? createMiddleware(routing)
     : createMiddleware(
         defineRouting({
           locales: ["en"],
           defaultLocale: "en",
-          localePrefix: "always",
+          localePrefix: "as-needed",
           localeDetection: true,
         }),
       );
```

**(b)** Ajustar el regex del `/es → /en` explicit redirect. Hoy emite `/en/<path>`; bajo `as-needed`, el canonical EN es `/<path>` (sin `/en`). Mantener el regex actual implicaría DOS redirects para tráfico ES legacy (`/es/hub` → `/en/hub` → `/hub`). Cortar en uno solo:

```diff
   if (!ES_READY) {
     const { pathname } = request.nextUrl;
     if (pathname === "/es" || pathname.startsWith("/es/")) {
-      const target = pathname.replace(/^\/es/, "/en") || "/en";
+      const target = pathname.replace(/^\/es/, "") || "/";
       const redirectUrl = new URL(target, request.url);
       redirectUrl.search = request.nextUrl.search;
       return NextResponse.redirect(redirectUrl, 307);
     }
   }
```

### 4.3 `apps/web/src/app/sitemap.ts`

Restructurar emisión de URLs: EN al root (sin prefix), ES con `/es/`, alternates apuntando a las URLs reales:

```diff
-const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://chesscito.com";
+const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.chesscito.com";

 // ...

 export default function sitemap(): MetadataRoute.Sitemap {
   const now = new Date();
   const entries: MetadataRoute.Sitemap = [];

-  // Naked "/" landing — redirects via middleware to the user's best
-  // locale; still indexable as a canonical entry point.
-  entries.push({
-    url: BASE_URL,
-    lastModified: now,
-    changeFrequency: "weekly",
-    priority: 1,
-    alternates: {
-      languages: Object.fromEntries(
-        routing.locales.map((locale) => [locale, `${BASE_URL}/${locale}`]),
-      ),
-    },
-  });
+  // Per-path canonical URL: default locale (EN) at root, non-default
+  // locales under `/<locale>/`. Alternates declare BOTH variants for
+  // each path so hreflang surfaces the right one per region.
+  const urlFor = (locale: string, path: string): string =>
+    locale === routing.defaultLocale
+      ? `${BASE_URL}${path || "/"}`
+      : `${BASE_URL}/${locale}${path}`;

   for (const path of STATIC_PATHS) {
-    const alternates = Object.fromEntries(
-      routing.locales.map((locale) => [locale, `${BASE_URL}/${locale}${path}`]),
-    );
+    const alternates = Object.fromEntries(
+      routing.locales.map((locale) => [locale, urlFor(locale, path)]),
+    );
     for (const locale of routing.locales) {
       entries.push({
-        url: `${BASE_URL}/${locale}${path}`,
+        url: urlFor(locale, path),
         lastModified: now,
         changeFrequency: path === "" ? "weekly" : "monthly",
         priority: path === "" ? 0.9 : 0.7,
         alternates: { languages: alternates },
       });
     }
   }

   return entries;
 }
```

### 4.4 `apps/web/src/app/[locale]/layout.tsx`

```diff
-const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://chesscito.com";
+const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.chesscito.com";

 // ...

   alternates: {
     /**
-     * Default-locale canonical at the locale root. Per-page surfaces
-     * (`/[locale]/hub`, `/[locale]/arena`, etc.) inherit this layout
-     * metadata, so EN / ES / x-default get emitted on every page via
-     * a single declaration. Google + Bing read `x-default` as the
-     * fallback when no locale matches the user.
+     * EN canonical at root (localePrefix: "as-needed"). ES variants
+     * stay under `/es`. Per-page surfaces inherit this layout
+     * metadata. Google / Bing read `x-default` as the fallback when
+     * no locale matches the user.
      */
     languages: {
-      en: '/en',
+      en: '/',
       es: '/es',
-      'x-default': '/en',
+      'x-default': '/',
     },
   },
```

### Estimación de cambio total

- 4 archivos.
- ~25 líneas modificadas (la mayoría son comentarios + sitemap restructure).
- 0 archivos nuevos, 0 archivos borrados.
- 0 modificaciones a componentes de producto.

---

## 5. Riesgos identificados

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | VR baselines existentes que screenshotean a `/en/<path>` se rompen si el sistema de tests asume el path bare | Media | Medio | Identificar los Playwright fixtures con grep `goto.*\/en\/` antes del commit; refrescar baselines en mismo PR si rompen |
| R2 | Tests vitest/jsdom que mockean rutas con prefix `/en/` continúan pasando (mocks no van por middleware) | Baja | Bajo | Confirmar con `pnpm test:unit` post-cambio |
| R3 | OG share URLs generadas server-side podrían quedar inconsistentes (algunas con `/en/`, otras sin) | Media | Medio | Audit a `lib/og/share-urls.ts` antes del commit; alinear el shape a `as-needed` |
| R4 | Tráfico ES legacy (cookies `NEXT_LOCALE=es` + bookmarks `/es/*`) se redirige al EN root sin avisar | Baja | Bajo | Por diseño actual: ES_READY=false → ES no debe servirse. El cambio (b) en middleware mantiene comportamiento, solo evita el doble hop |
| R5 | `redirect("/hub")` en `[locale]/page.tsx:37` para usuarios MiniPay sigue funcionando bien para EN pero podría romper si en el futuro el usuario llega con cookie ES | Muy baja | Bajo | Hoy ES_READY=false → cookie ES no es posible vía UI. Si ES_READY se activa, refactor a `getPathname` |
| R6 | SEO regression — search engines re-crawl después del switch y pierden equity transitorio mientras el canonical cambia de `/en/<path>` a `/<path>` | Media | Bajo (tráfico SEO actual chico) | Sitemap submission a Google Search Console post-deploy para acelerar re-index |
| R7 | `/en/<path>` deja de ser primary URL → next-intl canonicaliza a `/<path>` con 307 (one-time per bookmark) | Alta | Bajo | Esperado y deseado. Bookmarks antiguos siguen funcionando, sólo con un hop transitorio |
| R8 | Test E2E que abren `goto("/")` esperando ver `/en` en el URL post-load fallan | Media | Bajo | Refrescar las aserciones en el mismo PR; identificar con grep `expect.*url.*\/en` |

**Sin riesgos identificados:** no hay riesgo a contratos, payment, identity, copy, performance de componentes específicos. El cambio es estrictamente de routing.

---

## 6. Plan de rollback

Reversible de forma trivial:

1. Revert del commit (`git revert <hash>`) regresa los 4 archivos a su estado anterior.
2. Sin migraciones de DB, sin schema changes, sin nuevas dependencias.
3. URLs `/en/<path>` siguen funcionando antes y después del switch (next-intl los redirige al canonical, pero responden).
4. URLs `/<path>` funcionan después del switch; antes del switch, eran redirigidas a `/en/<path>`. Si el revert se hace tarde, los enlaces sociales/bookmarks recién creados sin prefix volverían a redirigir.

**Trigger para rollback automático:** si VR baselines verdes pre-commit pasan a rojo > 5 fixtures simultáneamente sin diff visual aceptable, o si `/api/sitemap.xml` retorna URLs malformadas (vacías, sin host), o si `pnpm test` baja del baseline 1727 passing en > 3 tests no relacionados con routing.

---

## 7. Comandos de verificación

### Pre-commit (sin tocar nada todavía)

```bash
# Inventario de fixtures Playwright / E2E que asumen el prefix /en/
grep -rn -E "goto\(['\"]/en/" apps/web/e2e apps/web/playwright 2>/dev/null
grep -rn -E "expect.*\.url\(\).*\.toContain\(['\"]\/en" apps/web 2>/dev/null
grep -rn -E "page\.url\(\).*\/en" apps/web 2>/dev/null

# OG share URL audit (asegurar consistencia con el switch)
grep -n "/en" apps/web/src/lib/og/share-urls.ts

# Test unitarios que asumen URLs locale-prefixed
grep -rn -E "['\"]\\/en\\/" apps/web/src --include="*.test.ts" --include="*.test.tsx" | head -30
```

### Post-commit, build + tests locales

```bash
cd apps/web && pnpm typecheck && pnpm lint && pnpm test:unit
# VR opcional (largo; solo si toques tests asumieron paths):
pnpm test:e2e:visual -g "i18n|landing|hub|sitemap"
```

### Post-deploy a preview (Vercel branch)

```bash
# Cada URL debe responder 200 directo (no 307) en el preview:
BASE="https://<preview-url>.vercel.app"
for path in "" "/hub" "/about" "/why" "/support" "/terms" "/privacy" "/exercises" "/arena" "/trophies"; do
  printf "%-15s → " "$path"
  curl -sI -o /dev/null -w "HTTP %{http_code} | redirect: %{redirect_url}\n" "$BASE$path"
done

# /en/* legacy debe 307 a la URL bare (one-hop, deseado):
for path in "/en" "/en/hub" "/en/about"; do
  printf "%-15s → " "$path"
  curl -sI -o /dev/null -w "HTTP %{http_code} | redirect: %{redirect_url}\n" "$BASE$path"
done

# Sitemap debe listar bare URLs para EN, /es/ para ES:
curl -s "$BASE/sitemap.xml" | head -40
```

---

## 8. URLs a probar manualmente (post-deploy)

Cada una debe responder **HTTP 200 directo** (no 307) tras el switch, excepto las legacy `/en/*` que se canonicalizan a bare con un hop esperado:

| URL | Pre-switch | Post-switch esperado |
|---|---|---|
| `https://www.chesscito.com` | 307 → `/en` | **200 (landing)** ✅ |
| `https://www.chesscito.com/hub` | 307 → `/en/hub` | **200 (hub)** ✅ |
| `https://www.chesscito.com/en` | 200 | 307 → `/` (next-intl canonicaliza) |
| `https://www.chesscito.com/en/hub` | 200 | 307 → `/hub` |
| `https://www.chesscito.com/support` | 307 → `/en/support` | **200 (support page)** ✅ |
| `https://www.chesscito.com/terms` | 307 → `/en/terms` | **200 (terms page)** ✅ |
| `https://www.chesscito.com/privacy` | 307 → `/en/privacy` | **200 (privacy page)** ✅ |

**Validación de MiniPay path específicamente:**

| Escenario | Resultado esperado |
|---|---|
| MiniPay abre `https://www.chesscito.com` | Servidor detecta UA MiniPay en `[locale]/page.tsx` → `redirect("/hub")` → `/hub` renderiza directo (sin segundo hop). 1 redirect total vs 3 hoy. |
| Browser desktop sin cookie | Middleware negocia `Accept-Language` → si EN, render `/` directo (0 redirects). Si ES, rewrite interno (0 redirects públicos). |
| Browser desktop con cookie `NEXT_LOCALE=es` (ES_READY=false) | Middleware ve cookie ES, pero ES_READY OFF → trata como EN → render directo bare. |
| Visita `https://www.chesscito.com/es/hub` (ES_READY=false) | Middleware explicit handler: 307 → `/hub` (vs `/en/hub → /hub` two-hop pre-fix). |

---

## 9. Re-medición Lighthouse post-commit (commit subsiguiente)

Una vez aplicado el patch + deployed a producción, repetir las mediciones de `docs/pagespeed-report-2026-06-02.md` contra:

- `https://www.chesscito.com` (mobile + desktop)
- `https://www.chesscito.com/hub` (mobile + desktop)
- `https://www.chesscito.com/en/hub` (mobile + desktop) — sanity, debe seguir respondiendo aunque sea con redirect

Métrica clave a observar:
- **`redirects` audit savings**: debe caer a ~0 ms para `/` y `/hub` (vs 3553 / 10935 hoy).
- **Mobile perf score**: hub debería subir de 53 a ~67 (la diferencia entre redirect/no-redirect medida hoy).
- **LCP**: hub mobile 9.1 s → ~7 s esperado.

El report nuevo iría como `docs/pagespeed-report-<fecha-post-deploy>.md` siguiendo el formato del anterior.

---

## 10. Mensaje de commit propuesto

```
perf(i18n): serve default locale from root paths

next-intl localePrefix flips from "always" to "as-needed". The default
locale (EN) now serves at the root (/hub, /about, /support, ...) while
non-default locales keep their prefix (/es/hub).

Eliminates the 307 hop documented in docs/pagespeed-report-2026-06-02.md:
3553 ms mobile and 10935 ms desktop per visit on the redirects audit.
Applies to every route on every visit. MiniPay entrypoint path reduces
from 3 redirects to 1.

Files touched:
- i18n/routing.ts: localePrefix "always" -> "as-needed".
- middleware.ts: same flip in the ES_READY=false fallback; /es/* redirect
  now points to bare path (one-hop) instead of /en/* (two-hop).
- app/sitemap.ts: EN URLs at root, ES under /es; default BASE_URL bumped
  to www.chesscito.com.
- app/[locale]/layout.tsx: alternates languages updated to { en: '/',
  es: '/es', 'x-default': '/' }; default BASE_URL bumped to
  www.chesscito.com.

Legacy /en/* URLs continue to work via next-intl canonicalization
(307 -> bare path). Bookmarks and social shares still resolve.

Wolfcito 🐾 @akawolfcito
```

---

## 11. Pregunta para desbloquear el patch

Antes de aplicar:

1. **¿Confirmás que el switch a `as-needed` es el lever correcto** (vs alternativas como duplicar páginas en root — más invasivo — o desactivar middleware en MiniPay UA — frágil)?
2. **¿Querés que primero corra los grep de la sección 7 (pre-commit)** para identificar VR fixtures y tests que asuman `/en/*` y agrupar el patch + sus fixes en el MISMO commit, o preferís split: commit A = config flip, commit B = test/VR fixes?
3. **¿Mantenemos el bump de `BASE_URL` default a `www.chesscito.com` en este commit** (alineado con commit 1) o lo separamos?

Mi recomendación: hacer los grep pre-commit ahora para conocer el alcance de fixes; si son pocos (<5 archivos de tests/fixtures), bundle todo en un solo commit (regla `bundle-dont-defer`). Si son muchos, split. El `BASE_URL` bump lo mantengo dentro del mismo commit porque toca los mismos 2 archivos.
