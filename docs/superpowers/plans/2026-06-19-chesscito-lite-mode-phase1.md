# Chesscito Lite Mode — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir `CHESSCITO_LITE_MODE` build-time flag que reduce la superficie visible a Train/Progress/Stats en el proyecto Lite de Vercel, sin romper el proyecto Full.

**Architecture:** Helper central en `src/lib/feature-flags.ts` → importado en `middleware.ts` (redirect de rutas Full-only, locale-aware) y en `hub-scaffold-client.tsx` (supresión de Sheets y CTAs Full-only). El flag es una constante de build-time (`NEXT_PUBLIC_*`), baked por Vercel en cada proyecto por separado.

**Tech Stack:** Next.js 14 App Router, TypeScript, Vitest + RTL, middleware next-intl, `routing.locales` de `@/i18n/routing`.

## Global Constraints

- **NUNCA** modificar: rutas de API, lógica de pagos, contratos, Supabase, Redis, salts, admin tokens.
- **NUNCA** tocar `.env` reales ni secretos; solo `.env.template` (key sin valor sensible).
- Full project (`LITE_MODE=false`) debe quedar bit-identical al estado actual.
- No optimización de bundle en Phase 1; solo reducción de superficie y navegación.
- Commits: Conventional Commits + firma `Wolfcito 🐾 @akawolfcito`.
- Typecheck: `pnpm exec tsc --noEmit` desde `apps/web/`.
- Tests: `pnpm -C apps/web test` (Vitest).
- **NUNCA** usar `cd` antes de `git` — usar `git -C <ruta-absoluta>`.
- Stagear paths explícitos en `git add`; nunca globs con brackets.
- Branch de trabajo: `feature/chesscito-lite-mode`.

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `apps/web/src/lib/feature-flags.ts` | Modify | Export `CHESSCITO_LITE_MODE` build-time constant |
| `apps/web/src/lib/__tests__/feature-flags.test.ts` | Create | Unit tests para el export |
| `apps/web/src/lib/lite-mode-routing.ts` | Create | Pure functions para detección locale-aware de rutas Full-only |
| `apps/web/src/lib/__tests__/lite-mode-routing.test.ts` | Create | Unit tests para las pure functions |
| `apps/web/src/middleware.ts` | Modify | Añadir bloque Lite redirect usando `liteRedirectTarget()` |
| `apps/web/src/components/hub/hub-scaffold-client.tsx` | Modify | Gate sheets y CTAs en Lite Mode |
| `apps/web/src/components/hub/__tests__/hub-scaffold-client.test.tsx` | Modify | Añadir tests de Lite Mode |
| `apps/web/.env.template` | Modify | Documentar `NEXT_PUBLIC_CHESSCITO_LITE_MODE` |

---

## Task 1: Helper central en `feature-flags.ts`

**Files:**
- Modify: `apps/web/src/lib/feature-flags.ts`
- Create: `apps/web/src/lib/__tests__/feature-flags.test.ts`

**Interfaces:**
- Produces: `export const CHESSCITO_LITE_MODE: boolean`

- [ ] **Step 1: Escribir el test (red)**

Crear `apps/web/src/lib/__tests__/feature-flags.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from "vitest";

describe("CHESSCITO_LITE_MODE", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("is false when env var is absent", async () => {
    vi.stubEnv("NEXT_PUBLIC_CHESSCITO_LITE_MODE", "");
    const { CHESSCITO_LITE_MODE } = await import("@/lib/feature-flags");
    expect(CHESSCITO_LITE_MODE).toBe(false);
  });

  it("is false when env var is 'false'", async () => {
    vi.stubEnv("NEXT_PUBLIC_CHESSCITO_LITE_MODE", "false");
    const { CHESSCITO_LITE_MODE } = await import("@/lib/feature-flags");
    expect(CHESSCITO_LITE_MODE).toBe(false);
  });

  it("is true when env var is 'true'", async () => {
    vi.stubEnv("NEXT_PUBLIC_CHESSCITO_LITE_MODE", "true");
    const { CHESSCITO_LITE_MODE } = await import("@/lib/feature-flags");
    expect(CHESSCITO_LITE_MODE).toBe(true);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
pnpm -C apps/web test src/lib/__tests__/feature-flags.test.ts
```

Esperado: FAIL con `Cannot find module` o `CHESSCITO_LITE_MODE is not exported`.

- [ ] **Step 3: Implementar el helper**

Reemplazar el contenido de `apps/web/src/lib/feature-flags.ts` (actualmente `export {}`):

```ts
export const CHESSCITO_LITE_MODE =
  process.env.NEXT_PUBLIC_CHESSCITO_LITE_MODE === "true";
```

- [ ] **Step 4: Correr y verificar que pasa**

```bash
pnpm -C apps/web test src/lib/__tests__/feature-flags.test.ts
```

Esperado: 3/3 PASS.

- [ ] **Step 5: Typecheck**

```bash
pnpm -C apps/web exec tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 6: Commit**

```bash
git -C /ruta/absoluta/al/repo add apps/web/src/lib/feature-flags.ts apps/web/src/lib/__tests__/feature-flags.test.ts
git -C /ruta/absoluta/al/repo commit -m "feat: add CHESSCITO_LITE_MODE build-time flag

Wolfcito 🐾 @akawolfcito"
```

---

## Task 2: Pure functions locale-aware para Lite redirect

**Files:**
- Create: `apps/web/src/lib/lite-mode-routing.ts`
- Create: `apps/web/src/lib/__tests__/lite-mode-routing.test.ts`

**Interfaces:**
- Consumes: `routing.locales: readonly string[]`, `routing.defaultLocale: string` de `@/i18n/routing`
- Produces:
  - `isFullOnlyPath(pathname: string, locales: readonly string[], defaultLocale: string): boolean`
  - `getLiteHubTarget(pathname: string, locales: readonly string[], defaultLocale: string): string`

Estas funciones son puras (sin side-effects) para que sean fácilmente unit-testables sin necesitar `NextRequest`.

- [ ] **Step 1: Escribir los tests (red)**

Crear `apps/web/src/lib/__tests__/lite-mode-routing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  isFullOnlyPath,
  getLiteHubTarget,
} from "@/lib/lite-mode-routing";

const LOCALES = ["en", "es"] as const;
const DEFAULT = "en";

describe("isFullOnlyPath", () => {
  it("detects /arena", () => {
    expect(isFullOnlyPath("/arena", LOCALES, DEFAULT)).toBe(true);
  });

  it("detects /arena/subpath", () => {
    expect(isFullOnlyPath("/arena/anything", LOCALES, DEFAULT)).toBe(true);
  });

  it("detects /coach", () => {
    expect(isFullOnlyPath("/coach", LOCALES, DEFAULT)).toBe(true);
  });

  it("detects /coach/history", () => {
    expect(isFullOnlyPath("/coach/history", LOCALES, DEFAULT)).toBe(true);
  });

  it("detects /victory/[id]", () => {
    expect(isFullOnlyPath("/victory/abc123", LOCALES, DEFAULT)).toBe(true);
  });

  it("detects /shop (future route, guard noop)", () => {
    expect(isFullOnlyPath("/shop", LOCALES, DEFAULT)).toBe(true);
  });

  it("detects /pro", () => {
    expect(isFullOnlyPath("/pro", LOCALES, DEFAULT)).toBe(true);
  });

  it("detects /founder", () => {
    expect(isFullOnlyPath("/founder", LOCALES, DEFAULT)).toBe(true);
  });

  it("strips ES locale prefix before checking", () => {
    expect(isFullOnlyPath("/es/arena", LOCALES, DEFAULT)).toBe(true);
  });

  it("strips explicit EN locale prefix before checking", () => {
    expect(isFullOnlyPath("/en/arena", LOCALES, DEFAULT)).toBe(true);
  });

  it("is false for /hub", () => {
    expect(isFullOnlyPath("/hub", LOCALES, DEFAULT)).toBe(false);
  });

  it("is false for /exercises", () => {
    expect(isFullOnlyPath("/exercises", LOCALES, DEFAULT)).toBe(false);
  });

  it("is false for /stats", () => {
    expect(isFullOnlyPath("/stats", LOCALES, DEFAULT)).toBe(false);
  });

  it("is false for /trophies", () => {
    expect(isFullOnlyPath("/trophies", LOCALES, DEFAULT)).toBe(false);
  });

  it("is false for /share/score", () => {
    expect(isFullOnlyPath("/share/score", LOCALES, DEFAULT)).toBe(false);
  });

  it("is false for /es/hub", () => {
    expect(isFullOnlyPath("/es/hub", LOCALES, DEFAULT)).toBe(false);
  });

  it("is false for /", () => {
    expect(isFullOnlyPath("/", LOCALES, DEFAULT)).toBe(false);
  });
});

describe("getLiteHubTarget", () => {
  it("returns /hub for bare /arena (default locale, no prefix)", () => {
    expect(getLiteHubTarget("/arena", LOCALES, DEFAULT)).toBe("/hub");
  });

  it("returns /es/hub for /es/arena", () => {
    expect(getLiteHubTarget("/es/arena", LOCALES, DEFAULT)).toBe("/es/hub");
  });

  it("returns /hub for /en/arena (default locale, strip /en prefix)", () => {
    expect(getLiteHubTarget("/en/arena", LOCALES, DEFAULT)).toBe("/hub");
  });

  it("returns /hub for /coach/history", () => {
    expect(getLiteHubTarget("/coach/history", LOCALES, DEFAULT)).toBe("/hub");
  });

  it("returns /es/hub for /es/coach/history", () => {
    expect(getLiteHubTarget("/es/coach/history", LOCALES, DEFAULT)).toBe("/es/hub");
  });

  it("returns /hub for /victory/abc123", () => {
    expect(getLiteHubTarget("/victory/abc123", LOCALES, DEFAULT)).toBe("/hub");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
pnpm -C apps/web test src/lib/__tests__/lite-mode-routing.test.ts
```

Esperado: FAIL con `Cannot find module '@/lib/lite-mode-routing'`.

- [ ] **Step 3: Implementar las pure functions**

Crear `apps/web/src/lib/lite-mode-routing.ts`:

```ts
const FULL_ONLY_SEGMENTS = [
  "arena",
  "coach",
  "victory",
  "shop",
  "pro",
  "founder",
] as const;

/**
 * Strips a known locale prefix from a pathname.
 * Under "as-needed" localePrefix, the default locale (EN) has NO prefix
 * at the canonical URL, but next-intl may still receive /en/* requests
 * (external bookmarks, etc.) — strip those too.
 *
 * Returns the canonical path (always starts with /) after stripping.
 */
function stripLocalePrefix(
  pathname: string,
  locales: readonly string[],
  defaultLocale: string,
): { canonical: string; localePrefix: string } {
  for (const locale of locales) {
    if (
      pathname === `/${locale}` ||
      pathname.startsWith(`/${locale}/`)
    ) {
      const localePrefix = locale === defaultLocale ? "" : `/${locale}`;
      const canonical =
        pathname.slice(`/${locale}`.length) || "/";
      return { canonical, localePrefix };
    }
  }
  return { canonical: pathname, localePrefix: "" };
}

/**
 * Returns true when the pathname (with or without a locale prefix)
 * resolves to a Full-only segment.
 */
export function isFullOnlyPath(
  pathname: string,
  locales: readonly string[],
  defaultLocale: string,
): boolean {
  const { canonical } = stripLocalePrefix(pathname, locales, defaultLocale);
  return FULL_ONLY_SEGMENTS.some(
    (seg) =>
      canonical === `/${seg}` || canonical.startsWith(`/${seg}/`),
  );
}

/**
 * Returns the locale-appropriate /hub target path to redirect to.
 * Examples:
 *   /arena       → /hub
 *   /es/arena    → /es/hub
 *   /en/arena    → /hub  (EN is the default locale, no prefix)
 */
export function getLiteHubTarget(
  pathname: string,
  locales: readonly string[],
  defaultLocale: string,
): string {
  const { localePrefix } = stripLocalePrefix(pathname, locales, defaultLocale);
  return `${localePrefix}/hub`;
}
```

- [ ] **Step 4: Correr y verificar que pasa**

```bash
pnpm -C apps/web test src/lib/__tests__/lite-mode-routing.test.ts
```

Esperado: todos los tests PASS.

- [ ] **Step 5: Typecheck**

```bash
pnpm -C apps/web exec tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 6: Commit**

```bash
git -C /ruta/absoluta/al/repo add \
  apps/web/src/lib/lite-mode-routing.ts \
  apps/web/src/lib/__tests__/lite-mode-routing.test.ts
git -C /ruta/absoluta/al/repo commit -m "feat: add locale-aware Lite Mode routing helpers

Wolfcito 🐾 @akawolfcito"
```

---

## Task 3: Middleware redirect Lite (locale-aware)

**Files:**
- Modify: `apps/web/src/middleware.ts`

**Interfaces:**
- Consumes: `CHESSCITO_LITE_MODE` de `@/lib/feature-flags`, `isFullOnlyPath` y `getLiteHubTarget` de `@/lib/lite-mode-routing`, `routing` de `@/i18n/routing`

No se añaden unit tests para el middleware en sí (el middleware de Next.js es difícil de unit-testear sin el runtime; las pure functions ya están cubiertas en Task 2). La validación es smoke manual y el typecheck.

- [ ] **Step 1: Leer el archivo actual completo**

Leer `apps/web/src/middleware.ts` para entender el contexto exacto antes de editar.

- [ ] **Step 2: Añadir imports y bloque Lite al middleware**

Modificar `apps/web/src/middleware.ts` para que quede:

```ts
import createMiddleware from "next-intl/middleware";
import { defineRouting } from "next-intl/routing";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
import { isFullOnlyPath, getLiteHubTarget } from "@/lib/lite-mode-routing";

const ES_READY = process.env.NEXT_PUBLIC_I18N_ES_READY === "1";

const intlMiddleware = ES_READY
  ? createMiddleware(routing)
  : createMiddleware(
      defineRouting({
        locales: ["en"],
        defaultLocale: "en",
        localePrefix: "as-needed",
        localeDetection: true,
      }),
    );

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!ES_READY) {
    if (pathname === "/es" || pathname.startsWith("/es/")) {
      const target = pathname.replace(/^\/es/, "") || "/";
      const redirectUrl = new URL(target, request.url);
      redirectUrl.search = request.nextUrl.search;
      return NextResponse.redirect(redirectUrl, 307);
    }
  }

  if (CHESSCITO_LITE_MODE) {
    if (isFullOnlyPath(pathname, routing.locales, routing.defaultLocale)) {
      const targetPath = getLiteHubTarget(
        pathname,
        routing.locales,
        routing.defaultLocale,
      );
      return NextResponse.redirect(new URL(targetPath, request.url), 307);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|dev|.*\\..*).*)",
  ],
};
```

Nota: el bloque Lite va **después** del bloque ES_READY y **antes** de `intlMiddleware`. El orden asegura que:
1. Primero se resuelven los redirects de locale legacy (`/es/*` cuando ES no está ready).
2. Luego se interceptan las rutas Full-only en Lite.
3. Por último, `intlMiddleware` maneja el resto (canonicalización de locale, cookies, etc.).

- [ ] **Step 3: Typecheck**

```bash
pnpm -C apps/web exec tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 4: Smoke manual (con el servidor de dev)**

```bash
# Terminal 1 — levantar con Lite Mode activo
NEXT_PUBLIC_CHESSCITO_LITE_MODE=true pnpm -C apps/web dev --port 3947
```

```bash
# Terminal 2 — verificar redirects
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3947/arena
# Esperado: 307 http://localhost:3947/hub

curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3947/es/arena
# Esperado: 307 http://localhost:3947/es/hub

curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3947/coach/history
# Esperado: 307 http://localhost:3947/hub

curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3947/hub
# Esperado: 200 (NO redirigido — es Lite-safe)

curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3947/exercises
# Esperado: 200 (NO redirigido)

curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3947/trophies
# Esperado: 200 (NO redirigido — trophies es Lite-safe)
```

- [ ] **Step 5: Verificar que Full Mode no redirige**

```bash
# Sin la var (default), Full mode
NEXT_PUBLIC_CHESSCITO_LITE_MODE=false pnpm -C apps/web dev --port 3948
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3948/arena
# Esperado: 200 (arena accesible en Full mode)
```

- [ ] **Step 6: Commit**

```bash
git -C /ruta/absoluta/al/repo add apps/web/src/middleware.ts
git -C /ruta/absoluta/al/repo commit -m "feat: add Lite Mode route redirect in middleware (locale-aware)

Wolfcito 🐾 @akawolfcito"
```

---

## Task 4: Gates en `hub-scaffold-client.tsx`

**Files:**
- Modify: `apps/web/src/components/hub/hub-scaffold-client.tsx`
- Modify: `apps/web/src/components/hub/__tests__/hub-scaffold-client.test.tsx`

**Interfaces:**
- Consumes: `CHESSCITO_LITE_MODE` de `@/lib/feature-flags`

**Qué se suprime en Lite Mode (`CHESSCITO_LITE_MODE === true`):**

| Elemento | Acción |
|---|---|
| `<ProSheet>` | No renderizado |
| `<ShopSheet>` | No renderizado |
| `<PurchaseConfirmSheet>` | No renderizado |
| `<BadgeSheet>` | No renderizado |
| `onArenaPress` | No-op (no navega a `/arena`) |
| `onProTap` / `onProTilePress` / `onPremiumTap` | No-op (no abre sheet) |
| `onShieldsTap` | No-op |
| `onCoachTap` | No-op |
| `initialSheet` de `shop`/`pro`/`badges` | Ignorado (no abre sheet) |
| `track("monetization.*")` | Suprimido |

Los hooks `useProSheetState`, `useShopSheetState`, `useBadgeSheetState` **siguen corriendo** — no se eliminan para evitar un refactor mayor. Solo se suprime el JSX renderizado y los handlers de tap.

- [ ] **Step 1: Añadir tests de Lite Mode (red)**

Al final del archivo `apps/web/src/components/hub/__tests__/hub-scaffold-client.test.tsx`, antes del cierre, añadir:

```ts
// Mock feature-flags as a module to allow Lite Mode testing.
// The mock is hoisted per vitest conventions; override per-describe as needed.
vi.mock("@/lib/feature-flags", () => ({
  CHESSCITO_LITE_MODE: false, // default: Full Mode
}));

describe("HubScaffoldClient — Lite Mode", () => {
  beforeEach(() => {
    vi.mock("@/lib/feature-flags", () => ({
      CHESSCITO_LITE_MODE: true,
    }));
  });

  afterEach(() => {
    vi.mock("@/lib/feature-flags", () => ({
      CHESSCITO_LITE_MODE: false,
    }));
    cleanup();
  });

  it("does not navigate to /arena when arena CTA is pressed in Lite Mode", async () => {
    const user = userEvent.setup();
    render(<HubScaffoldClient />);

    // The arena button aria label comes from HUB_SCAFFOLD_COPY.playAriaLabel
    const arenaButton = screen.queryByRole("button", { name: /enter arena/i });
    if (arenaButton) {
      await user.click(arenaButton);
      expect(pushMock).not.toHaveBeenCalledWith(expect.stringContaining("/arena"));
    }
    // If the button is not rendered at all in Lite, the test passes trivially —
    // that's also valid (hidden > no-op).
  });

  it("does not navigate to /coach when coach CTA is pressed in Lite Mode", async () => {
    const user = userEvent.setup();
    useAccountMock.mockReturnValue({ address: TEST_WALLET, isConnected: true });
    useProStatusMock.mockReturnValue({
      status: { active: true, expiresAt: Date.now() + 7 * 86_400_000 },
      isLoading: false,
      refetch: vi.fn(),
    });
    render(<HubScaffoldClient />);

    const coachButton = screen.queryByRole("button", { name: /coach/i });
    if (coachButton) {
      await user.click(coachButton);
      expect(pushMock).not.toHaveBeenCalledWith(expect.stringContaining("/coach"));
    }
  });

  it("does not fire monetization telemetry for PRO in Lite Mode", () => {
    render(<HubScaffoldClient />);
    const monEvents = trackMock.mock.calls
      .map(([event]: [string]) => event)
      .filter((e: string) => e.startsWith("monetization."));
    expect(monEvents).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
pnpm -C apps/web test src/components/hub/__tests__/hub-scaffold-client.test.tsx
```

Esperado: nuevos tests FAIL (arena/coach aún navegan, monetization events aún se disparan).

- [ ] **Step 3: Añadir import y gates en `hub-scaffold-client.tsx`**

Añadir import al principio del archivo (después de los imports existentes):

```ts
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";
```

Luego aplicar los gates. Localizar el `handleArenaPress`:

```ts
// Antes:
const handleArenaPress = useCallback(() => {
  track("secondary_arena_clicked");
  router.push("/arena?fresh=1");
}, [router]);

// Después:
const handleArenaPress = useCallback(() => {
  if (CHESSCITO_LITE_MODE) return;
  track("secondary_arena_clicked");
  router.push("/arena?fresh=1");
}, [router]);
```

En el `useEffect` de PRO telemetry (el que llama `track("pro_training_card_viewed", ...)` y `track("monetization.pro_chip_view", ...)`), envolver la sección de monetization:

```ts
// Localizar el useEffect que hace track("pro_training_card_viewed"...)
// y añadir guard al inicio del effect:
useEffect(() => {
  if (CHESSCITO_LITE_MODE) return;
  if (proTrainingCardViewedRef.current) return;
  // ... resto del effect igual
}, [address, isConnected, pro, proStatus]);
```

En el JSX de retorno, envolver las sheets Full-only:

```tsx
// Antes:
return (
  <>
    <HubScaffold
      // ...props
      onArenaPress={handleArenaPress}
      onProTap={() => { ... proSheet.openSheet(); }}
      onCoachTap={() => { ... router.push("/coach/history") ... }}
      onProTilePress={() => { ... proSheet.openSheet(); }}
      onPremiumTap={() => { ... proSheet.openSheet(); }}
      onShieldsTap={() => { ... shopSheet.openSheet(); }}
    />
    <ProSheet {...proSheet.sheetProps} />
    <BadgeSheet {...badgeSheet.sheetProps} />
    <ShopSheet {...shopSheet.sheetProps} />
    <PurchaseConfirmSheet {...shopSheet.confirmProps} />
    <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    <Sheet open={settingsOpen} ...>...</Sheet>
  </>
);

// Después:
return (
  <>
    <HubScaffold
      // ...props — sin cambios en props pasadas, solo los handlers:
      onArenaPress={handleArenaPress}
      onProTap={CHESSCITO_LITE_MODE ? undefined : () => {
        track("hub_pro_chip_tap", { pro_active: pro.active });
        track("monetization.pro_chip_tap", {
          active: pro.active,
          daysRemaining: pro.active ? pro.daysRemaining : null,
        });
        proSheet.openSheet();
      }}
      onCoachTap={CHESSCITO_LITE_MODE ? undefined : () => {
        track("hub_coach_chip_tap", { pro_active: pro.active });
        if (pro.active) {
          router.push("/coach/history");
        } else {
          proSheet.openSheet();
        }
      }}
      onProTilePress={CHESSCITO_LITE_MODE ? undefined : () => {
        track("hub_pro_tile_tap", { pro_active: pro.active });
        proSheet.openSheet();
      }}
      onPremiumTap={CHESSCITO_LITE_MODE ? undefined : () => {
        track("hub_premium_slot_tap", { pro_active: pro.active });
        proSheet.openSheet();
      }}
      onShieldsTap={CHESSCITO_LITE_MODE ? undefined : () => {
        track("hub_shields_chip_tap", { shield_count: shieldCount });
        shopSheet.openSheet();
      }}
    />
    {!CHESSCITO_LITE_MODE && <ProSheet {...proSheet.sheetProps} />}
    {!CHESSCITO_LITE_MODE && <BadgeSheet {...badgeSheet.sheetProps} />}
    {!CHESSCITO_LITE_MODE && <ShopSheet {...shopSheet.sheetProps} />}
    {!CHESSCITO_LITE_MODE && <PurchaseConfirmSheet {...shopSheet.confirmProps} />}
    <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
      {/* ...contenido settings igual */}
    </Sheet>
  </>
);
```

También, en el `useEffect` que maneja `initialSheet`, suprimir la apertura de sheets Full-only en Lite:

```ts
useEffect(() => {
  if (!initialSheet || initialSheetOpenedRef.current) return;
  initialSheetOpenedRef.current = true;
  if (!CHESSCITO_LITE_MODE) {
    if (initialSheet === "shop") {
      openShopSheet();
    } else if (initialSheet === "pro") {
      openProSheet();
    } else if (initialSheet === "badges") {
      openBadgeSheet();
    }
  }
  if (initialSheet === "trophies") {
    router.push("/trophies");
  }
  // profile + settings abren via useState — siguen igual
}, [initialSheet, openBadgeSheet, openProSheet, openShopSheet, router]);
```

- [ ] **Step 4: Correr y verificar que los tests pasan**

```bash
pnpm -C apps/web test src/components/hub/__tests__/hub-scaffold-client.test.tsx
```

Esperado: todos PASS, incluyendo los tests existentes (Full Mode no tocado).

- [ ] **Step 5: Correr suite completa para detectar regresiones**

```bash
pnpm -C apps/web test
```

Esperado: misma cantidad de tests pasando que antes (o más). Cero fallos nuevos.

- [ ] **Step 6: Typecheck**

```bash
pnpm -C apps/web exec tsc --noEmit
```

Esperado: 0 errores.

- [ ] **Step 7: Commit**

```bash
git -C /ruta/absoluta/al/repo add \
  apps/web/src/components/hub/hub-scaffold-client.tsx \
  apps/web/src/components/hub/__tests__/hub-scaffold-client.test.tsx
git -C /ruta/absoluta/al/repo commit -m "feat: gate Full-only sheets and CTAs in hub-scaffold for Lite Mode

Wolfcito 🐾 @akawolfcito"
```

---

## Task 5: Documentar env var en `.env.template`

**Files:**
- Modify: `apps/web/.env.template`

- [ ] **Step 1: Leer el template actual**

Leer `apps/web/.env.template` para encontrar el lugar correcto donde insertar la nueva var. Buscar una sección de feature flags o vars `NEXT_PUBLIC_*` existentes.

- [ ] **Step 2: Añadir la línea**

Añadir al final de la sección de feature flags (o al final del archivo si no hay sección clara):

```
# Lite Mode — set to "true" in the Chesscito Lite Vercel project.
# Full project must explicitly set this to "false".
# Default is off (false) — Full experience.
NEXT_PUBLIC_CHESSCITO_LITE_MODE=false
```

- [ ] **Step 3: Typecheck final y suite completa**

```bash
pnpm -C apps/web exec tsc --noEmit && pnpm -C apps/web test
```

Esperado: 0 errores de TS, todos los tests pasan.

- [ ] **Step 4: Commit final**

```bash
git -C /ruta/absoluta/al/repo add apps/web/.env.template
git -C /ruta/absoluta/al/repo commit -m "docs: document NEXT_PUBLIC_CHESSCITO_LITE_MODE in env template

Wolfcito 🐾 @akawolfcito"
```

---

## Self-Review

### 1. Spec coverage

| Requisito del spec | Tarea |
|---|---|
| Helper central `CHESSCITO_LITE_MODE` en `feature-flags.ts` | Task 1 |
| Middleware redirect locale-aware (`/arena` → `/hub`, `/es/arena` → `/es/hub`) | Task 2 + 3 |
| `routing.locales` como fuente de verdad (no lista duplicada) | Task 2 (`lite-mode-routing.ts` recibe `routing.locales` como parámetro) |
| Gates en `hub-scaffold-client.tsx`: sheets ProSheet/ShopSheet/PurchaseConfirmSheet/BadgeSheet | Task 4 |
| Gates CTAs: Arena, Coach, PRO, Shields | Task 4 |
| Supresión de telemetría monetization en Lite | Task 4 |
| `initialSheet` de shop/pro/badges ignorado en Lite | Task 4 |
| `.env.template` documentado | Task 5 |
| Full mode sin cambios | Task 1-5 (tests Full Mode siguen pasando; gates son `if (CHESSCITO_LITE_MODE)`) |
| No tocar pagos/API/Supabase | ✅ (no se modifican esos módulos) |
| `/trophies` Lite-safe | ✅ (no aparece en FULL_ONLY_SEGMENTS) |

### 2. Placeholder scan

Sin TBDs, todos los steps tienen código concreto.

### 3. Type consistency

- `isFullOnlyPath(pathname: string, locales: readonly string[], defaultLocale: string): boolean` — usado igual en Task 2 (tests) y Task 3 (middleware).
- `getLiteHubTarget(pathname: string, locales: readonly string[], defaultLocale: string): string` — mismo signature en tests y middleware.
- `CHESSCITO_LITE_MODE: boolean` — importado como `boolean` constante en Tasks 1, 4.
