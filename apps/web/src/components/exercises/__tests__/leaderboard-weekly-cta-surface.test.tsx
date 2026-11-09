/**
 * ⛔ El destino de la tarjeta semanal SIGUE A LA SUPERFICIE.
 *
 * El ranking semanal está scopeado por superficie: entra quien tiene una fila
 * en `score_attempts` con la superficie DEL DEPLOYMENT dentro de la semana
 * (`weekly_ranking`, migración 20260801000000, y `requireDeploymentSurface`).
 *
 * Antes esta tarjeta tenía la copy de LEARN ("complete an exercise") y el
 * enlace de PLAY (`/arena?fresh=1`) al mismo tiempo, así que estaba mal en las
 * dos superficies en direcciones opuestas — y en LEARN además expulsaba al
 * jugador a otro dominio, porque `mode-routing` rebota todo `/arena` al host de
 * play. Eso fabricaba una visita de Play desde una pantalla de Learn.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

const accountState = { address: "0x" + "a".repeat(40) };
vi.mock("wagmi", () => ({ useAccount: () => accountState }));

const isPlayModeMock = vi.fn();
// ⚠️ PARCIAL, con importOriginal: reemplazar el modulo entero deja sin definir
// todo lo demas que el arbol importa de feature-flags, y el hijo que lo use
// revienta sin decir por que — la hoja simplemente no renderiza.
vi.mock("@/lib/feature-flags", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/feature-flags")>()),
  isPlayMode: () => isPlayModeMock(),
  isLearnMode: () => !isPlayModeMock(),
  isWeeklyLeadersEnabled: () => true,
}));

vi.mock("@/lib/identity/use-nickname-tokens", () => ({
  useNicknameTokens: () => ({}),
}));
vi.mock("@/hooks/use-display-name", () => ({
  useDisplayName: () => ({ customName: null }),
}));

import { LeaderboardSheet } from "@/components/exercises/leaderboard-sheet";
import messages from "@/lib/content/messages/en";

/** Weekly con el jugador FUERA del ranking: el estado que muestra la tarjeta. */
function serveEmptyWeek() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ window: "weekly", rows: [], player: null, total: 0 }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ),
  );
}

function renderSheet() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LeaderboardSheet open onOpenChange={vi.fn()} showTrigger={false} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => serveEmptyWeek());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("la tarjeta de elegibilidad semanal", () => {
  /**
   * ⛔ En LEARN la acción canónica es hacer un ejercicio. Mandar a `/arena`
   * manda a una superficie cuya actividad NO PUEDE satisfacer el requisito.
   */
  it("en LEARN lleva a los ejercicios, no a la Arena", async () => {
    isPlayModeMock.mockReturnValue(false);
    const view = renderSheet();

    const cta = await waitFor(() => {
      const node = document.querySelector('[data-testid="leaderboard-weekly-cta"] a');
      expect(node).toBeTruthy();
      return node as HTMLAnchorElement;
    });

    expect(cta.getAttribute("href")).toContain("/exercises");
    expect(cta.getAttribute("href")).not.toContain("/arena");
    expect(screen.getByText(/complete an exercise/i)).toBeInTheDocument();
  });

  /** En PLAY el requisito es jugar una partida, y ahí `/arena` SÍ corresponde. */
  it("en PLAY lleva a la Arena y lo dice", async () => {
    isPlayModeMock.mockReturnValue(true);
    const view = renderSheet();

    const cta = await waitFor(() => {
      const node = document.querySelector('[data-testid="leaderboard-weekly-cta"] a');
      expect(node).toBeTruthy();
      return node as HTMLAnchorElement;
    });

    expect(cta.getAttribute("href")).toContain("/arena");
    expect(screen.getByText(/play a match/i)).toBeInTheDocument();
  });

  /**
   * ⚠️ La copy y el destino tienen que moverse JUNTOS. Fijarlos por separado es
   * exactamente cómo quedaron contradiciéndose durante meses.
   */
  it("nunca ofrece una acción que no corresponde a su texto", async () => {
    for (const play of [true, false]) {
      isPlayModeMock.mockReturnValue(play);
      const view = renderSheet();

      const cta = await waitFor(() => {
        const node = document.querySelector(
          '[data-testid="leaderboard-weekly-cta"] a',
        );
        expect(node).toBeTruthy();
        return node as HTMLAnchorElement;
      });

      const href = cta.getAttribute("href") ?? "";
      const saysExercise = /complete an exercise/i.test(cta.textContent ?? "");
      expect(href.includes("/exercises")).toBe(saysExercise);
      view.unmount();
    }
  });
});
