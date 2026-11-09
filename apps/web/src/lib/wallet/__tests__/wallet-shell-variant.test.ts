/**
 * Spec: docs/specs/2026-08-07-wallet-shell-skeleton.md — C1 / AC1.
 *
 * `WalletProviderBoundary` vive en el root layout, así que su shell se renderiza
 * en TODA ruta. Pintar la silueta del hub en `/terms` sería prometer una
 * pantalla que nunca llega — peor que el vacío, porque el vacío no miente.
 *
 * ⚠️ Los casos negativos de abajo (`/enough`, `/esfoo`) no son adorno: son la
 * forma exacta en que se rompe un resolver escrito con `startsWith("/en")`, que
 * es la primera implementación que a cualquiera se le ocurre.
 */
import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";
import { resolveWalletShellVariant } from "@/lib/wallet/wallet-shell-variant";

describe("resolveWalletShellVariant — el hub y nada más", () => {
  it.each([
    ["/", "hub"],
    ["/es", "hub"],
    // `/en` lo canonicaliza next-intl con un 307 (localePrefix: "as-needed"),
    // pero el pathname del cliente puede leerlo antes del salto.
    ["/en", "hub"],
    // Barra final: el router no la entrega (Next redirige 308 con
    // `trailingSlash: false`), pero el tipo acepta cualquier string y un caller
    // puede producirla. Se normaliza para que la misma página no dé dos
    // respuestas distintas.
    ["/es/", "hub"],
    ["/en/", "hub"],
  ])("%s → %s", (pathname, expected) => {
    expect(resolveWalletShellVariant(pathname)).toBe(expected);
  });

  it.each([
    ["/terms"],
    ["/es/terms"],
    ["/en/terms"],
    ["/exercises"],
    ["/stats"],
    ["/arena"],
    ["/foo"],
    // ⚠️ Los tres que matan al `startsWith`: empiezan con el prefijo de un
    // locale y no son el hub.
    ["/esfoo"],
    ["/enough"],
    ["/english"],
    [""],
  ])("%s → plain", (pathname) => {
    expect(resolveWalletShellVariant(pathname)).toBe("plain");
  });

  it.each([[null], [undefined]])("%s → plain — sin saber dónde estamos, no se promete un hub", (pathname) => {
    expect(resolveWalletShellVariant(pathname)).toBe("plain");
  });

  it("deriva las rutas de routing.locales, no de una lista escrita a mano", () => {
    // El guard contra el drift: si mañana entra un locale nuevo, su raíz tiene
    // que ser hub sin que nadie toque este módulo. Falla si alguien hardcodeó.
    for (const locale of routing.locales) {
      expect(resolveWalletShellVariant(`/${locale}`)).toBe("hub");
    }
  });
});
