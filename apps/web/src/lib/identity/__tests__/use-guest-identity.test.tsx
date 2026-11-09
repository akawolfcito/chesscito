// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import enMessages from "@/lib/content/messages/en";
import { useGuestIdentity } from "../use-guest-identity";
import { GUEST_STORAGE_KEY, guestSeed } from "../guest-id";
import { deriveAvatarVariant, formatGuestNickname } from "../identity-lite";
import { IDENTITY_COPY } from "@/lib/content/editorial";
import type { NicknameTokens } from "../identity-lite";

const wrapper = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider
    locale="en"
    messages={enMessages as Record<string, unknown>}
    onError={() => {}}
    getMessageFallback={({ key, namespace }) =>
      namespace ? `${namespace}.${key}` : key
    }
  >
    {children}
  </NextIntlClientProvider>
);

describe("useGuestIdentity", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("yields a stable guest identity after mount (client-gated via useEffect)", async () => {
    const { result } = renderHook(() => useGuestIdentity(), { wrapper });

    await waitFor(() => expect(result.current).not.toBeNull());

    const id = window.localStorage.getItem(GUEST_STORAGE_KEY)!;
    const expectedVariant = deriveAvatarVariant(guestSeed(id));
    expect(result.current!.variant).toEqual(expectedVariant);
    expect(result.current!.name).toBe(
      formatGuestNickname(
        expectedVariant,
        IDENTITY_COPY as unknown as NicknameTokens,
      ),
    );
    // Guest nickname carries the localized prefix, not a wallet.
    expect(result.current!.name.startsWith("Guest ")).toBe(true);
    expect(result.current!.name).not.toMatch(/0x/);
  });
});
