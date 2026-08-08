// apps/web/src/components/hub/__tests__/challenge-card-cta-css.test.ts
//
// Spec: docs/specs/2026-08-07-daily-cta-content-loop.md (AC-5, AC-6a)
//
// SOURCE GUARDS, on purpose. jsdom does not do layout — `getBoundingClientRect`
// returns zeros and `getComputedStyle` never resolves globals.css — so a unit
// test that claims to measure the slot's height would pass green without
// measuring anything. These read the stylesheet instead, and the rendered
// result is covered by the VR baseline.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CSS = readFileSync(
  join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

/** Returns the declaration block of a rule whose selector matches exactly. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = CSS.match(new RegExp(`^${escaped}\\s*\\{([^}]*)\\}`, "m"));
  if (!match) throw new Error(`Rule not found in globals.css: ${selector}`);
  return match[1];
}

function declaredValue(body: string, prop: string): string | null {
  const match = body.match(new RegExp(`(?:^|;|\\n)\\s*${prop}\\s*:\\s*([^;]+)`));
  return match ? match[1].trim() : null;
}

describe("CTA slot — terminal state styling (AC-5)", () => {
  const quiet = ruleBody(".challenge-card-cta--quiet");

  // The defect this sprint removes: the old terminal kept the button skin and
  // dimmed it. Desaturated + lowered opacity + button shape is the universal
  // vocabulary of a BROKEN control, delivered right after a success.
  it("never dims or desaturates: a legend is not a disabled button", () => {
    expect(quiet).not.toMatch(/saturate\(/);
    expect(quiet).not.toMatch(/\bfilter\s*:/);
    expect(quiet).not.toMatch(/\bopacity\s*:/);
  });

  /* REENCUADRADO 2026-08-07. Antes esto prohibía `background`, `border` y
     `box-shadow`, y con eso habría bloqueado la banda de aviso que el founder
     pidió. Pero la superficie NUNCA fue el defecto: lo que decía "roto" era el
     ATENUADO sobre forma de botón, y eso lo cubre el test de arriba.

     Lo que de verdad hay que impedir es que la banda prometa un tap que no
     existe. En este panel la tocabilidad la comunican tres señales concretas,
     tomadas del banner del Season Pass:
       - el chevron `›`
       - el relieve `box-shadow: 0 3px 0` (el borde inferior de botón)
       - la clase `is-pulsing`

     CONTRATO: el chevron y el relieve son el contrato de tap. El día que esta
     banda aloje un enlace real, los gana EN EL MISMO COMMIT en que gana su
     handler. Nunca uno sin el otro. Este test es lo que lo obliga. */
  it("carries no tap contract: no raised edge, no pulse, no pointer", () => {
    // El relieve de botón. Las sombras `inset` siguen permitidas: dan volumen
    // a una superficie sin prometer que se hunde al tocarla.
    expect(quiet).not.toMatch(/box-shadow\s*:[^;]*(?<!inset\s)0\s+3px\s+0/);
    expect(quiet).not.toMatch(/is-pulsing/);
    expect(quiet).not.toMatch(/cursor\s*:\s*pointer/);
  });

  /* Sprint 1.5: `.challenge-card-cta--info` was DELETED. It was the last dimmed
     button-shaped slab in the product, and its only consumer (`complete`) now
     says its state in the status chip instead of spending the CTA slot on it.
     Reintroducing the rule would bring the original defect back for the player
     who finished the whole challenge. */
  it("has no dimmed-button rule left anywhere in the sheet", () => {
    // A RULE, not a mention: the tombstone comment above the deletion names the
    // class on purpose, and a bare name match would flag its own gravestone.
    expect(CSS).not.toMatch(/\.challenge-card-cta--info\s*[,{]/);
  });
});

describe("CTA slot — action banner (2026-08-07)", () => {
  const action = ruleBody(".challenge-card-cta--action");

  /* ⛔ There is no hover on a phone. Sinking on press is the ONLY confirmation
     the tap registered, and it must land before the navigation does because
     /exercises is not light. Drop this and the player taps, sees nothing, and
     taps again — a double tap on a CTA that navigates is how duplicate entries
     get made. Omitting it breaks nothing visible, which is exactly why it needs
     a guard and not a comment. */
  it("sinks on press, so a slow navigation cannot read as a dead tap", () => {
    const pressed = ruleBody(".challenge-card-cta--action:active");
    expect(pressed).toMatch(/bevel-pressed/);
    expect(pressed).toMatch(/translateY/);
  });

  // The separator from the $0.99 offer is an inversion of VALUE, not of hue:
  // green and gold collapse into the same hue under deuteranopia/protanopia,
  // and ~8% of men would lose the difference between training and paying.
  it("inverts value against the offer: dark surface, light text", () => {
    expect(action).toMatch(/var\(--cta-primary-green-grad\)/);
    expect(action).toMatch(/color:\s*#f4ffe4/i);
  });

  // The base green comes from the shared primary-action tokens, so refining the
  // green refines this banner too. The sheen layers on top are decoration and
  // may be literal; the SURFACE colour may not.
  it("takes its green from the shared tokens, never a literal", () => {
    expect(action).toMatch(/var\(--cta-primary-green-grad\)/);
    expect(action).toMatch(/var\(--cta-primary-green-border\)/);
    expect(action).toMatch(/var\(--cta-primary-green-bevel\)/);
  });

  /* ⛔ `action` and `status` are the two states that ALTERNATE for the same
     player, render after render, so they are the pair whose heights must match
     — not `.principal-button-medium`, which this slot no longer uses at all
     since the CTA became a banner. This anchor is where the CLS 0,179 lived. */
  it("reserves the same box as the state it alternates with", () => {
    expect(declaredValue(action, "min-height")).toBe(
      declaredValue(ruleBody(".challenge-card-cta--quiet"), "min-height"),
    );
  });
});

describe("CTA slot — the tap contract lives in the markup too", () => {
  // El guard de CSS no alcanza: el chevron es un componente, no una regla.
  // Si alguien lo agrega al render del estado terminal, el CSS de arriba pasa
  // en verde y la banda igual promete un tap.
  it("the terminal branch renders no chevron", () => {
    const card = readFileSync(
      join(process.cwd(), "src/components/hub/challenge-card.tsx"),
      "utf8",
    );
    // El bloque del status, desde su marca hasta el cierre del ternario.
    const status = card.slice(card.indexOf('data-cta-kind="status"'));
    const block = status.slice(0, status.indexOf("</p>"));
    expect(block).not.toMatch(/ChevronIcon/);
  });
});

describe("CTA slot — reserved box (AC-6a)", () => {
  // ⛔ This anchor is where the CLS 0,179 closed on 2026-08-07 lived. If the
  // terminal state collapses to text height, the card changes height between
  // presentations and the layout shift comes straight back.
  //
  // There is no shared token for the button's height, so the two declared
  // values are compared directly: drift in either one fails here.
  it("declares a reserved min-height at all", () => {
    // The pairing against `--action` is asserted in the action-banner block:
    // that is the state this one alternates with. Here we only pin that the
    // terminal never collapses to text height.
    const quiet = declaredValue(ruleBody(".challenge-card-cta--quiet"), "min-height");
    expect(quiet).not.toBeNull();
    expect(quiet).toBe("52px");
  });
});
