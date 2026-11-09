/**
 * Spec: docs/specs/2026-08-07-hub-anchor-cls-fix.md — AC15.
 *
 * ⚠️ GUARD DE IMPLEMENTACIÓN, y se declara como tal.
 *
 * `align-self: stretch` sólo existe en un motor de layout real. jsdom no calcula
 * layout, así que NINGÚN test de comportamiento puede ver su efecto: borrar la
 * declaración deja la suite entera en verde y el CLS vuelve a 0,179. El VR
 * tampoco lo protege — fotografía el estado final, que hoy es idéntico con y sin
 * el fix (ver el P1 abajo).
 *
 * POR QUÉ LA DECLARACIÓN ES NECESARIA
 * -----------------------------------
 * `.hub-scaffold-center` es `flex-direction: column` + `align-items: center`, así
 * que sus items NO se estiran en el eje transversal: se dimensionan por
 * contenido. El contenido de `.hub-scaffold-anchor` es el portal
 * (`<picture>` → `<img>`), que no aporta ancho hasta tener tamaño intrínseco.
 *
 *   contenido 0 → item 0 → el `width: 100%` de `.kingdom-anchor` resuelve
 *   contra 0 → su `aspect-ratio` produce altura 0.
 *
 * Cuando llega `naturalWidth`, el item pasa a 234 px, el anchor gana 363,8 de
 * alto y la fila del hub crece +153 px. Eso es el CLS 0,179 medido
 * (`docs/audits/2026-08-07-minipay-cls-discovery.md`).
 *
 * ⚠️ P1 — LA EQUIVALENCIA VISUAL ES CONDICIONAL. Hoy `stretch` y el
 * comportamiento anterior convergen porque la columna disponible (234 px) es
 * MENOR que el ancho intrínseco del portal (256 px), así que el shrink-to-fit
 * siempre topaba con el mismo tope. Si cambia `--app-max-width`, la geometría de
 * tracks, o el asset se re-exporta más chico, esa equivalencia **debe
 * revalidarse**. ⛔ Y `234 × 363,8` NO es una constante universal: es el estado
 * final del viewport medido (390 × 844), no un contrato global.
 *
 * Re-validación en layout real (AC16): ver el informe de cierre del frente.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const CSS = readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");

/** El bloque de reglas de `.hub-scaffold-anchor`, acotado por su llave de cierre. */
function ruleBlock(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  if (start === -1) return "";
  return CSS.slice(start, CSS.indexOf("}", start) + 1);
}

describe("AC15 — el anchor del hub reserva su caja sin depender de la imagen", () => {
  it("declara align-self: stretch", () => {
    // Sin esto el item se dimensiona por contenido y el CLS 0,179 vuelve.
    expect(ruleBlock(".hub-scaffold-anchor")).toMatch(/align-self:\s*stretch/);
  });

  it("no introduce medidas nuevas: el fix no contiene números (AC4)", () => {
    // El ancho lo da el track de la grilla y el alto el `aspect-ratio` que
    // `KingdomAnchor` fija por variante. Un px acá sería una tercera fuente para
    // un número que ya tiene dos dueños.
    const block = ruleBlock(".hub-scaffold-anchor");
    const stretchLine = block
      .split("\n")
      .find((line) => line.includes("align-self"));

    expect(stretchLine).toBeDefined();
    expect(stretchLine).not.toMatch(/\d/);
  });

  it("la columna sigue centrando a sus OTROS hijos", () => {
    // El fix es `align-self` en un item, no `align-items` en el contenedor:
    // `AppModeSwitch` y `hub-scaffold-center-stack` no se tocan.
    expect(ruleBlock(".hub-scaffold-center")).toMatch(/align-items:\s*center/);
  });
});
