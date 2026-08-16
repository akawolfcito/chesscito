import { describe, it, expect } from "vitest";

import { resolveThemeAsset } from "@/lib/themes/resolve-theme-asset";
import { DUEL_LOBBY_SLOTS } from "../lobby";

/**
 * ⛔ LO QUE ESTE ARCHIVO DEJA MEDIDO, y que yo habia asumido al reves.
 *
 * Un slot sin `default` NO resuelve a null: el tema le asigna una ruta
 * DETERMINISTICA igual, exista o no el archivo. Por eso un chequeo de vacio
 * sobre el resolver es siempre falso, y el primer intento de carga mostro tres
 * imagenes rotas con el alt encima.
 *
 * De ahi sale el diseno del lobby: la unica fuente de verdad sobre si el
 * archivo existe es la RED, asi que cada candidata se prueba cargandola y solo
 * se muestran las que responden. Si esta prueba se pusiera roja algun dia
 * (porque el resolver empezo a devolver null), el probe se vuelve innecesario
 * y se puede simplificar — pero hasta entonces es lo unico que funciona.
 */
describe("como resuelve un slot del lobby sin archivo", () => {
  it("devuelve una ruta deterministica, NO null", () => {
    for (const slot of DUEL_LOBBY_SLOTS) {
      const resolved = resolveThemeAsset(slot, "default", "candy-forest");
      expect(resolved).toContain("/art/theme-builder/candy-forest/arena/");
      expect(resolved).not.toBeNull();
    }
  });
});
