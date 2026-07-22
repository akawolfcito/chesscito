# Task 8 — tests que esperan a los slots

Estos cuatro casos se escribieron durante la Task 5 y **no pueden vivir en el repo
hasta que los slots existan**: `s.key === "landing.og-image"` es un error de
compilación (TS2367) mientras `"landing.og-image"` no esté en el union
`ThemeAssetKey`, no una aserción que falla.

Al ejecutar la Task 8, crear
`apps/web/src/lib/themes/__tests__/single-file-slots.test.ts` con este contenido
**antes** de registrar los slots, verlo fallar, y registrarlos.

```ts
import { describe, it, expect, vi } from "vitest";
import { buildThemeCatalog, type AssetResolver } from "../catalog";

const okResolver: AssetResolver = vi.fn(async (basename: string) => ({
  file: `${basename}.png`,
  width: 1024,
  height: 1024,
  format: "png" as const,
  mtime: 1_700_000_000_000,
  hasBackup: false,
}));

describe("the three brand/social slots", () => {
  it("reports the declared format for a single-file slot", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const og = catalog?.slots.find((s) => s.key === "landing.og-image");
    expect(og?.format).toBe("jpg");
  });

  it("passes the format down to the resolver so it probes one extension", async () => {
    const seen: { basename: string; format?: string }[] = [];
    const spy: AssetResolver = async (basename, context) => {
      seen.push({ basename, format: context?.format });
      return {
        file: `${basename}.jpg`,
        width: 1200,
        height: 630,
        format: "jpg" as const,
        mtime: 1,
        hasBackup: false,
      };
    };
    await buildThemeCatalog("candy-forest", spy);
    const og = seen.find((s) => s.basename === "/og/chesscito-landing");
    expect(og?.format).toBe("jpg");
  });

  it("marks a derived slot with the key it comes from", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const favicon = catalog?.slots.find((s) => s.key === "brand.favicon-ico");
    expect(favicon?.derivedFrom).toBe("brand.favicon");
    const apple = catalog?.slots.find((s) => s.key === "brand.apple-icon");
    expect(apple?.derivedFrom).toBe("brand.favicon");
  });

  it("leaves derivedFrom null for the independently editable OG card", async () => {
    const catalog = await buildThemeCatalog("candy-forest", okResolver);
    const og = catalog?.slots.find((s) => s.key === "landing.og-image");
    expect(og?.derivedFrom).toBeNull();
  });
});
```

## Lo mismo aplica a la Task 6

Los dos tests de "derived slots" del `route.test.ts` nombran
`brand.favicon-ico` y `brand.apple-icon` en un `FormData`, que es un `string`
sin tipar — ahí **no** hay error de compilación, así que esos sí pueden
escribirse en la Task 6 y quedar en rojo hasta la Task 8, como decía el plan.
