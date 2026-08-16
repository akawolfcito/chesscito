import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ⛔ Los criterios de aceptación de la puerta, como pruebas.
 *
 * La puerta tapa el DESCUBRIMIENTO y nada más: quien ya tiene un enlace juega.
 * Estos tests fijan las cinco condiciones que el founder pidió, incluida la que
 * no es de runtime — que promover `main` no pueda cambiar lo que producción
 * muestra.
 */

const SRC = join(process.cwd(), "src");

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function flag() {
  return (await import("../duel-flag")).DUEL_DISCOVERY_ENABLED;
}

describe("la puerta del descubrimiento", () => {
  it("se abre solo con el string exacto", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DUEL", "true");
    expect(await flag()).toBe(true);
  });

  /**
   * ⛔ AUSENTE ES CERRADO. Un entorno que nadie configuró queda cerrado, así
   * que producción es segura por defecto y una variable olvidada nunca puede
   * abrir la puerta.
   */
  it("está cerrada cuando nadie la configuró", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DUEL", "");
    expect(await flag()).toBe(false);
  });

  it("no la abre nada que se le parezca", async () => {
    for (const value of ["TRUE", "1", "yes", "false", "on"]) {
      vi.resetModules();
      vi.stubEnv("NEXT_PUBLIC_ENABLE_DUEL", value);
      expect(await flag()).toBe(false);
    }
  });
});

describe("lo que la puerta NO toca", () => {
  /**
   * ⛔ Un gate sobre las rutas romperia una invitacion ya repartida, y el
   * producto entero es un enlace que alguien guarda. Las cinco rutas no deben
   * saber que la puerta existe.
   */
  it("las rutas del duelo no leen la bandera", () => {
    for (const route of [
      "app/api/duel/route.ts",
      "app/api/duel/[id]/route.ts",
      "app/api/duel/[id]/join/route.ts",
      "app/api/duel/[id]/move/route.ts",
      "app/api/duel/[id]/resign/route.ts",
    ]) {
      const source = readFileSync(join(SRC, route), "utf8");
      expect(source).not.toContain("NEXT_PUBLIC_ENABLE_DUEL");
      expect(source).not.toContain("DUEL_DISCOVERY_ENABLED");
    }
  });

  /** La Arena tampoco: abrir `?duel=<id>` tiene que seguir funcionando. */
  it("la Arena del duelo no lee la bandera", () => {
    const source = readFileSync(join(SRC, "components/duel/duel-arena.tsx"), "utf8");
    expect(source).not.toContain("DUEL_DISCOVERY_ENABLED");
  });
});

describe("no hay otra puerta de entrada", () => {
  /**
   * ⛔ El criterio "ningun otro entry point expone P2P". Si manana alguien
   * agrega un boton al hub, este test lo obliga a decidir la exposicion a
   * proposito en vez de abrirla sin querer.
   */
  it("la unica pantalla que ofrece crear un duelo es el selector de rival", () => {
    const page = readFileSync(join(SRC, "app/[locale]/arena/page.tsx"), "utf8");

    // El unico disparador vive detras de la bandera.
    expect(page).toContain("onSelectFriend={DUEL_DISCOVERY_ENABLED ?");
    // Y el selector solo dibuja la tarjeta si le pasan el handler.
    const scaffold = readFileSync(
      join(SRC, "components/arena/arena-select-scaffold.tsx"),
      "utf8",
    );
    expect(scaffold).toContain("{onSelectFriend ? (");
  });
});

describe("promover main no cambia lo que produccion muestra", () => {
  /**
   * ⛔ El criterio que no es de runtime, y es estructural: si el valor viviera
   * en un archivo que el repo trackea, promover `main` lo arrastraria a
   * produccion. Solo hay `.env.template` / `.env.example`, que Next no lee, asi
   * que el valor unicamente puede venir de la env del deployment.
   */
  it("ningun archivo trackeado define la bandera", () => {
    for (const file of ["../../.env.template", "../../../../.env.example"]) {
      let contents = "";
      try {
        contents = readFileSync(join(SRC, file), "utf8");
      } catch {
        continue;
      }
      expect(contents).not.toMatch(/^\s*NEXT_PUBLIC_ENABLE_DUEL\s*=\s*true/m);
    }
  });
});
