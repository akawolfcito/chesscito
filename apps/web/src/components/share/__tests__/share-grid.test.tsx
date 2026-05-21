/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShareGrid } from "@/components/share/share-grid";

const TEXT = "I just locked my score!";
const URL = "https://chesscito.com/share/score?piece=rook&stars=9";

describe("ShareGrid", () => {
  it("renders Telegram tile instead of Messages (SMS)", () => {
    render(<ShareGrid text={TEXT} url={URL} />);
    expect(screen.getByRole("link", { name: /telegram/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /messages/i })).toBeNull();
  });

  it("Telegram tile uses t.me/share/url with encoded text + url", () => {
    render(<ShareGrid text={TEXT} url={URL} />);
    const tg = screen.getByRole("link", { name: /telegram/i }) as HTMLAnchorElement;
    expect(tg.href).toContain("https://t.me/share/url");
    expect(tg.href).toContain(`url=${encodeURIComponent(URL)}`);
    expect(tg.href).toContain(`text=${encodeURIComponent(TEXT)}`);
  });

  it("WhatsApp / X / Facebook tiles still present", () => {
    render(<ShareGrid text={TEXT} url={URL} />);
    expect(screen.getByRole("link", { name: /whatsapp/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /facebook/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /share on x/i })).toBeTruthy();
  });

  it("renders Save tile when cardUrl is provided", () => {
    render(<ShareGrid text={TEXT} url={URL} cardUrl="/api/og/exercise?piece=rook&stars=9" />);
    expect(screen.getByRole("button", { name: /save/i })).toBeTruthy();
  });

  it("renders Copy tile when cardUrl is omitted (no Save fallback)", () => {
    render(<ShareGrid text={TEXT} url={URL} />);
    expect(screen.getByRole("button", { name: /copy/i })).toBeTruthy();
  });

  it("renders More tile (OS share-sheet)", () => {
    render(<ShareGrid text={TEXT} url={URL} />);
    expect(screen.getByRole("button", { name: /more/i })).toBeTruthy();
  });
});
