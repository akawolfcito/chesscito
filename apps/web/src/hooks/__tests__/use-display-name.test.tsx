import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

import enMessages from "@/lib/content/messages/en";
import esMessages from "@/lib/content/messages/es";
import { useDisplayName, displayNameStorageKey } from "@/hooks/use-display-name";
import { deriveAvatarVariant, formatNickname } from "@/lib/identity/identity-lite";
import { IDENTITY_COPY } from "@/lib/content/editorial";

beforeEach(() => { window.localStorage.clear(); });

// Identity Lite generated nickname expected for the test wallet (EN bundle).
const WALLET = "0x0924abcdef1234567890abcdef1234567890eba4" as const;
const EXPECTED_VARIANT = deriveAvatarVariant(WALLET);
const EXPECTED_NICK_EN = formatNickname(
  EXPECTED_VARIANT,
  IDENTITY_COPY as unknown as Parameters<typeof formatNickname>[1],
);

function wrapperFor(locale: "en" | "es" = "en") {
  const messages = locale === "es" ? esMessages : enMessages;
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider
      locale={locale}
      messages={messages as Record<string, unknown>}
      onError={() => {}}
      getMessageFallback={({ key, namespace }) =>
        namespace ? `${namespace}.${key}` : key
      }
    >
      {children}
    </NextIntlClientProvider>
  );
  Wrapper.displayName = `IntlWrapper(${locale})`;
  return Wrapper;
}

describe("useDisplayName", () => {
  const wallet = "0x0924abcdef1234567890abcdef1234567890eba4" as const;

  it("falls back to the generated nickname (not the raw wallet)", () => {
    const { result } = renderHook(() => useDisplayName(wallet), {
      wrapper: wrapperFor("en"),
    });
    expect(result.current.name).toBe(EXPECTED_NICK_EN);
    expect(result.current.name).not.toMatch(/0x/);
  });

  it("exposes the avatar variant for a connected wallet", () => {
    const { result } = renderHook(() => useDisplayName(wallet), {
      wrapper: wrapperFor("en"),
    });
    expect(result.current.variant).toEqual(EXPECTED_VARIANT);
  });

  it("variant is undefined when no wallet is connected", () => {
    const { result } = renderHook(() => useDisplayName(undefined), {
      wrapper: wrapperFor("en"),
    });
    expect(result.current.variant).toBeUndefined();
  });

  it("returns persisted custom name", () => {
    window.localStorage.setItem(displayNameStorageKey(wallet), "Akawolf");
    const { result } = renderHook(() => useDisplayName(wallet), {
      wrapper: wrapperFor("en"),
    });
    expect(result.current.name).toBe("Akawolf");
  });

  it("persists name on setName", () => {
    const { result } = renderHook(() => useDisplayName(wallet), {
      wrapper: wrapperFor("en"),
    });
    act(() => result.current.setName("Wolfcito"));
    expect(result.current.name).toBe("Wolfcito");
    expect(window.localStorage.getItem(displayNameStorageKey(wallet))).toBe("Wolfcito");
  });

  it("clears name when given empty string", () => {
    window.localStorage.setItem(displayNameStorageKey(wallet), "Akawolf");
    const { result } = renderHook(() => useDisplayName(wallet), {
      wrapper: wrapperFor("en"),
    });
    act(() => result.current.setName(""));
    expect(result.current.name).toBe(EXPECTED_NICK_EN);
  });

  it("returns localized Visitor label when wallet is undefined (EN)", () => {
    const { result } = renderHook(() => useDisplayName(undefined), {
      wrapper: wrapperFor("en"),
    });
    expect(result.current.name).toBe("Visitor");
    expect(result.current.isVisitor).toBe(true);
  });

  it("returns localized Visitante label when wallet is undefined (ES)", () => {
    const { result } = renderHook(() => useDisplayName(undefined), {
      wrapper: wrapperFor("es"),
    });
    expect(result.current.name).toBe("Visitante");
    expect(result.current.isVisitor).toBe(true);
  });

  it("isVisitor is false once a wallet is connected", () => {
    const { result } = renderHook(() => useDisplayName(wallet), {
      wrapper: wrapperFor("es"),
    });
    expect(result.current.isVisitor).toBe(false);
  });
});
