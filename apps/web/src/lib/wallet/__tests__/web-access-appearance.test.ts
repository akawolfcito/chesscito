import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildWebAccessAppearance,
  WEB_ACCESS_MODAL_COPY,
} from "@/lib/wallet/web-access-appearance";

/** Privy's own limits, quoted from the `appearance` type in
 *  @privy-io/react-auth 2.25.0. Strings past the header cap are ellipsified. */
const LANDING_HEADER_MAX = 35;
const LOGIN_MESSAGE_MAX = 100;

/** What `brand.title` resolves to on the default theme. The builder takes the
 *  base as an argument precisely so it never hardcodes this. */
const WORDMARK_BASE = "/art/title-chesscito";

/** Relative luminance, WCAG definition. Privy generates the modal's foreground
 *  tones from `theme` by modulating its luminance and requires the value to be
 *  under 20% or over 80%, so a mid-tone would produce unreadable text. */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

describe("buildWebAccessAppearance", () => {
  it("accents Learn with the START FOCUS green and Play with the PLAY CHESS blue", () => {
    expect(buildWebAccessAppearance("learn", WORDMARK_BASE).accentColor).toBe("#72db2d");
    expect(buildWebAccessAppearance("play", WORDMARK_BASE).accentColor).toBe("#45c4f4");
  });

  it("keeps one modal background across both surfaces — only the accent differs", () => {
    const learn = buildWebAccessAppearance("learn", WORDMARK_BASE);
    const play = buildWebAccessAppearance("play", WORDMARK_BASE);
    expect(learn.theme).toBe(play.theme);
    expect(learn.logo).toBe(play.logo);
    expect(learn.landingHeader).toBe(play.landingHeader);
  });

  it("picks a theme dark enough for Privy to derive readable foregrounds", () => {
    const theme = buildWebAccessAppearance("learn", WORDMARK_BASE).theme as string;
    expect(theme).toMatch(/^#[0-9a-f]{6}$/);
    expect(relativeLuminance(theme)).toBeLessThan(0.2);
  });

  it("composes the logo from the resolved base, never from an /art literal", () => {
    expect(buildWebAccessAppearance("play", "/art/title-chesscito").logo).toBe(
      "/art/title-chesscito.webp",
    );
    // A creator theme resolves the same slot to its own base.
    expect(
      buildWebAccessAppearance("play", "/art/theme-builder/candy-forest/brand/title/pro")
        .logo,
    ).toBe("/art/theme-builder/candy-forest/brand/title/pro.webp");
  });

  it("omits the logo when the slot resolves to nothing, rather than requesting '.webp'", () => {
    expect(buildWebAccessAppearance("learn", "")).not.toHaveProperty("logo");
  });

  it("stays inside Privy's copy caps so nothing is ellipsified", () => {
    expect(WEB_ACCESS_MODAL_COPY.header.length).toBeLessThanOrEqual(LANDING_HEADER_MAX);
    expect(WEB_ACCESS_MODAL_COPY.message.length).toBeLessThanOrEqual(LOGIN_MESSAGE_MAX);
  });

  it("keeps the modal copy free of em-dashes, like the rest of the gate's voice", () => {
    expect(WEB_ACCESS_MODAL_COPY.header).not.toMatch(/—/);
    expect(WEB_ACCESS_MODAL_COPY.message).not.toMatch(/—/);
  });
});

describe("web access modal assets", () => {
  it("ships the wordmark the logo resolves to", () => {
    const logo = buildWebAccessAppearance("learn", WORDMARK_BASE).logo as string;
    expect(() => readFileSync(resolve(process.cwd(), "public", logo.slice(1)))).not.toThrow();
  });
});
