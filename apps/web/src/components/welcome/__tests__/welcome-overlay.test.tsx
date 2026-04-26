import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WelcomeOverlay } from "../welcome-overlay";

const STORAGE_KEY = "chesscito:welcome-dismissed";

describe("WelcomeOverlay", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders nothing when the welcome flag is already set", () => {
    localStorage.setItem(STORAGE_KEY, "1");
    render(<WelcomeOverlay />);
    expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();
  });

  it("renders the first card on a fresh device", () => {
    render(<WelcomeOverlay />);
    expect(screen.getByTestId("welcome-overlay")).toBeInTheDocument();
    expect(
      screen.getByText(/Aprendes piezas con retos cortos/i),
    ).toBeInTheDocument();
  });

  it("advances through the 3 cards with the Continuar button", () => {
    render(<WelcomeOverlay />);
    fireEvent.click(screen.getByTestId("welcome-next"));
    expect(screen.getByText(/Subes a Arena/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("welcome-next"));
    expect(screen.getByText(/Ganas trofeos on-chain/i)).toBeInTheDocument();
    expect(screen.getByText(/Empezar a jugar/i)).toBeInTheDocument();
  });

  it("dismisses on the final card and persists the flag", () => {
    render(<WelcomeOverlay />);
    fireEvent.click(screen.getByTestId("welcome-next")); // → card 2
    fireEvent.click(screen.getByTestId("welcome-next")); // → card 3
    fireEvent.click(screen.getByTestId("welcome-next")); // dismiss
    expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("dismisses on Saltar and persists the flag", () => {
    render(<WelcomeOverlay />);
    fireEvent.click(screen.getByText(/Saltar/i));
    expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });
});
