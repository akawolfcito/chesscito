/**
 * Spec: docs/specs/2026-08-07-wallet-shell-skeleton.md — C6 / AC2–AC4.
 *
 * Medido antes de escribir esto (`docs/audits/2026-08-07-minipay-perceived-load-report.md`):
 * bajo Slow 4G + CPU 4×, el jugador de MiniPay mira `#0b1220` plano durante ~4 s
 * y después el hub aparece entero de golpe. El skeleton existe para llenar esa
 * ventana sin pedir un solo byte nuevo.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WalletShell } from "@/components/wallet-shell";

describe("WalletShell — variante plain", () => {
  // ⚠️ NACE VERDE, y es a propósito: hoy el shell no tiene silueta, así que este
  // caso no puede fallar todavía. Su trabajo es seguir verde DESPUÉS de que
  // exista la silueta — es guard de regresión, no driver.
  it("no pinta silueta: fuera del hub el hueco sigue vacío", () => {
    const { container } = render(<WalletShell variant="plain" />);

    expect(container.querySelector("[data-wallet-shell]")).not.toBeNull();
    expect(container.querySelector(".wallet-shell-skeleton")).toBeNull();
  });

  it("plain es el default — un caller que se olvide no puede filtrar el hub", () => {
    const { container } = render(<WalletShell />);
    expect(container.querySelector(".wallet-shell-skeleton")).toBeNull();
  });
});

describe("WalletShell — variante hub", () => {
  it("pinta la silueta", () => {
    const { container } = render(<WalletShell variant="hub" />);
    expect(container.querySelector(".wallet-shell-skeleton")).not.toBeNull();
  });

  it("es invisible para lectores de pantalla y no recibe interacción", () => {
    const { container } = render(<WalletShell variant="hub" />);
    const skeleton = container.querySelector(".wallet-shell-skeleton");

    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    // Nada enfocable adentro: es un hueco, no una UI.
    expect(
      skeleton?.querySelectorAll("a, button, input, [tabindex]"),
    ).toHaveLength(0);
  });

  it("no lleva texto — no hay copy que traducir ni datos que inventar", () => {
    const { container } = render(<WalletShell variant="hub" />);
    expect(container.textContent).toBe("");
  });

  it("dibuja las tres franjas del hub: HUD, cuerpo y CTAs", () => {
    // La silueta comunica la FORMA, no el contenido. Si alguna franja
    // desaparece, el hueco deja de parecerse a lo que va a llegar.
    const { container } = render(<WalletShell variant="hub" />);

    expect(container.querySelector(".wallet-shell-skeleton-hud")).not.toBeNull();
    expect(container.querySelector(".wallet-shell-skeleton-body")).not.toBeNull();
    expect(container.querySelector(".wallet-shell-skeleton-cta")).not.toBeNull();
  });
});
