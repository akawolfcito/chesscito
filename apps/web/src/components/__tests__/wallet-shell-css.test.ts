/**
 * Spec: docs/specs/2026-08-07-wallet-shell-skeleton.md — AC8 / AC9.
 *
 * ⚠️ GUARDS DE FUENTE, y no por pereza: las dos cosas que este archivo protege
 * son invisibles para cualquier test de comportamiento.
 *
 *   - Que la silueta y `.hub-scaffold-body` compartan el ancho de riel: dos
 *     literales iguales renderizan idéntico hoy y divergen en silencio mañana.
 *     Este repo ya tiene escrito que una copia de medidas de layout no la
 *     delata NADA observable.
 *   - Que el relleno sea un recurso `data:` y no un gradiente: los dos pintan
 *     los mismos píxeles. La diferencia son 2,2 s de FCP, que ningún assert de
 *     DOM puede ver (EXP1/EXP1b, 2026-08-07).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const CSS = readFileSync(
  path.resolve(process.cwd(), "src/app/globals.css"),
  "utf8",
);

/** El bloque de reglas del skeleton, para no asertar sobre todo el archivo. */
/**
 * Sólo las reglas de la silueta.
 *
 * ⛔ Antes esto era `CSS.slice(indexOf(...))`, o sea DESDE la silueta HASTA EL
 * FINAL DEL ARCHIVO. Funcionaba únicamente porque la silueta era el último
 * bloque de `globals.css`, y el 2026-08-15 el bloque del duelo se agregó
 * después: sus gradientes cayeron dentro de la rebanada y este guard se puso
 * rojo acusando a la silueta de algo que no hizo.
 *
 * El guard tenía razón en lo que quiere proteger y estaba mal acotado. Ahora la
 * rebanada termina donde terminan las reglas `.wallet-shell-skeleton*`, así que
 * lo que se agregue después del bloque no puede acusarlo ni encubrirlo.
 */
const SKELETON_CSS = (() => {
  const start = CSS.indexOf(".wallet-shell-skeleton {");
  const rules = [...CSS.slice(start).matchAll(/\.wallet-shell-skeleton[\w-]*\s*\{[^}]*\}/g)];
  return rules.map((rule) => rule[0]).join("\n");
})();

describe("AC8 — la geometría se deriva, no se copia", () => {
  it("el ancho de riel vive en un token, no en un literal", () => {
    expect(CSS).toMatch(/--hub-rail-width:\s*\d+px/);
  });

  it("el hub y la silueta usan EL MISMO token para la grilla", () => {
    // Apuntado a las DOS reglas por nombre: un filtro por forma de la grilla
    // atrapaba `repeat(2, minmax(0, 1fr))` de reglas que no tienen nada que ver.
    for (const selector of [".hub-scaffold-body", ".wallet-shell-skeleton-body"]) {
      const rule = CSS.slice(CSS.indexOf(`${selector} {`));
      const grid = rule.match(/grid-template-columns:\s*([^;]+);/)?.[1] ?? "";

      expect(grid, selector).toContain("var(--hub-rail-width)");
      // ⛔ Si alguien reintroduce el literal en cualquiera de las dos, rojo.
      expect(grid, selector).not.toMatch(/\d+px/);
    }
  });
});

describe("AC9 — cero assets: el relleno es un recurso inline", () => {
  it("no pide un solo archivo", () => {
    // ⚠️ Sin regex glotona sobre el contenido: el `data:` URI lleva comillas
    // simples adentro (`xmlns='…'`), así que capturar "hasta la comilla" corta
    // la URL por la mitad y el guard pasa por ausencia.
    const opens = [...SKELETON_CSS.matchAll(/url\(\s*["']?/g)];

    expect(opens.length).toBeGreaterThan(0);
    for (const open of opens) {
      const rest = SKELETON_CSS.slice(open.index! + open[0].length);
      expect(rest.startsWith("data:")).toBe(true);
    }
  });

  it("el relleno es un `data:` SVG, NUNCA un gradiente", () => {
    // Medido: mismo bloque, mismos píxeles, 2,2 s de diferencia en FCP.
    // Chromium cuenta recursos de imagen, no pintura.
    expect(SKELETON_CSS).toMatch(/url\("data:image\/svg\+xml/);
    expect(SKELETON_CSS).not.toMatch(/linear-gradient|radial-gradient/);
  });

  it("la capa es fija — CLS 0 por construcción, no por medidas", () => {
    expect(SKELETON_CSS).toMatch(/\.wallet-shell-skeleton\s*\{[^}]*position:\s*fixed/);
  });

  it("no anima: bajo CPU 4× un pulse compite con la hidratación", () => {
    expect(SKELETON_CSS).not.toMatch(/animation:|@keyframes/);
  });
});
