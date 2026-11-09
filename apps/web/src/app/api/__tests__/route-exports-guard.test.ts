/**
 * Ningún `route.ts` puede exportar un nombre que Next no reconozca.
 *
 * ⛔ ESTE TEST EXISTE POR UN BUILD ROTO EN PRODUCCIÓN (2026-08-14). El route de
 * capacidad exportaba `__resetCapacityCache` —un hook de test, inofensivo en
 * apariencia— y Vercel falló con:
 *
 *     Type error: Route "src/app/api/access/capacity/route.ts" does not match
 *     the required types of a Next.js Route.
 *       "__resetCapacityCache" is not a valid Route export field.
 *
 * ⚠️ **Y NADA LOCAL LO HABÍA VISTO.** La suite entera pasaba (8.077 tests) y
 * `tsc --noEmit` daba exit 0, porque **esta validación no es de TypeScript: es
 * de `next build`**, que genera tipos por ruta y los compara. El único comando
 * del repo que la corre es `pnpm type-check` (`next build && tsc --noEmit`), no
 * el `tsc` suelto que usa la higiene de comandos de CLAUDE.md.
 *
 * Así que este archivo compra en 40 ms lo que costaba un build de 2 minutos: un
 * export de más se pone rojo acá, en la corrida que uno sí hace siempre.
 *
 * Un helper que el test necesita va en un módulo aparte (`lib/**`), que es de
 * dónde salió `lib/access/verdict-cache.ts`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const API_ROOT = join(__dirname, "..");

/** Lo que Next admite en un Route Handler. Cerrado a propósito: agregar acá sin
 *  confirmarlo contra la versión instalada de Next es reabrir el mismo bug. */
const ALLOWED = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "dynamic",
  "dynamicParams",
  "revalidate",
  "fetchCache",
  "runtime",
  "preferredRegion",
  "maxDuration",
  "generateStaticParams",
]);

function routeFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      routeFiles(full, found);
    } else if (entry === "route.ts" || entry === "route.tsx") {
      found.push(full);
    }
  }
  return found;
}

/** Nombres exportados, leídos del texto. Un parser de verdad sería mejor, pero
 *  las dos formas que este repo usa son `export function X` y `export const X`. */
function exportedNames(source: string): string[] {
  const names: string[] = [];
  const re =
    /^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) names.push(match[1]);
  return names;
}

describe("exports de los route handlers", () => {
  const files = routeFiles(API_ROOT);

  it("encuentra rutas que auditar", () => {
    // Si el walker se rompe, este archivo pasaría en verde sin mirar nada.
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    const relative = file.slice(file.indexOf("src/"));

    it(`${relative} no exporta nombres ajenos a Next`, () => {
      const offenders = exportedNames(readFileSync(file, "utf8")).filter(
        (name) => !ALLOWED.has(name),
      );

      expect(offenders).toEqual([]);
    });
  }
});
