import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const logout = vi.hoisted(() => vi.fn(async () => {}));
const disconnect = vi.hoisted(() => vi.fn());
const privyState = vi.hoisted(() => ({ ready: true, authenticated: true, address: "0xabc" }));

vi.mock("@privy-io/react-auth", () => ({
  PrivyProvider: ({ children }: { children?: ReactNode }) => children,
  useLogout: () => ({ logout }),
  usePrivy: () => ({ ready: privyState.ready, authenticated: privyState.authenticated }),
  useLogin: () => ({ login: vi.fn() }),
}));
// Partial mock: `web-wallet-provider` builds its wagmi config at module scope,
// so the real `fallback`/`http` transports must survive.
vi.mock("wagmi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("wagmi")>()),
  useDisconnect: () => ({ disconnect }),
  useAccount: () => ({ address: privyState.address }),
}));

import { PrivyWalletSession } from "@/components/web-wallet-provider";
import { WebAccessGate } from "@/components/web-access-gate";
import { useWalletSignOut } from "@/lib/wallet/wallet-session";
import { GUEST_STORAGE_KEY } from "@/lib/identity/guest-id";
import { milestoneStorageKey } from "@/lib/lite-progress-storage";

const providerSource = readFileSync(
  resolve(process.cwd(), "src/components/web-wallet-provider.tsx"),
  "utf8",
);
const sessionSource = readFileSync(
  resolve(process.cwd(), "src/lib/wallet/wallet-session.tsx"),
  "utf8",
);

/** Stands in for the Disconnect row of the Account sheet, which is a
 *  presentational leaf: it calls whatever `onDisconnect` its host passes. */
function DisconnectRow() {
  const signOut = useWalletSignOut();
  return (
    <button type="button" onClick={() => signOut()}>
      Disconnect
    </button>
  );
}

beforeEach(() => {
  logout.mockClear();
  disconnect.mockClear();
  privyState.ready = true;
  privyState.authenticated = true;
  privyState.address = "0xabc";
  localStorage.clear();
});

describe("PrivyWalletSession", () => {
  it("routes Disconnect through the official Privy logout", async () => {
    render(
      <PrivyWalletSession>
        <DisconnectRow />
      </PrivyWalletSession>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    // Dropping only the wagmi connector would leave the Privy session — and,
    // with HttpOnly cookies on `.chesscito.com`, the shared cookie — alive, so
    // the very next render would let the user straight back in.
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("leaves local progress and the local identity untouched", async () => {
    localStorage.setItem(GUEST_STORAGE_KEY, "guest-123");
    localStorage.setItem(milestoneStorageKey(), JSON.stringify({ seen: ["rook"] }));

    render(
      <PrivyWalletSession>
        <DisconnectRow />
      </PrivyWalletSession>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBe("guest-123");
    expect(localStorage.getItem(milestoneStorageKey())).toBe(
      JSON.stringify({ seen: ["rook"] }),
    );
  });

  it("shows the WebAccessGate again once Privy reports no session", () => {
    // What the user sees after logout: `authenticated` flips false, so the
    // gate reclaims the tree and productive children stop rendering.
    privyState.authenticated = false;
    privyState.address = "";
    const { container } = render(
      <PrivyWalletSession>
        <WebAccessGate>
          <div>hub</div>
        </WebAccessGate>
      </PrivyWalletSession>,
    );

    expect(container.querySelector('[data-web-access="unauthenticated"]')).not.toBeNull();
    expect(screen.queryByText("hub")).not.toBeInTheDocument();
  });
});

describe("blast radius", () => {
  it("never reaches payments, entitlements or MiniPay from the session layer", () => {
    for (const source of [providerSource, sessionSource]) {
      expect(source).not.toMatch(/payment/i);
      expect(source).not.toMatch(/@\/lib\/(pro|peones|season-pass|shop)/);
      expect(source).not.toMatch(/@\/lib\/minipay/);
    }
  });

  it("does not add a second sign-out control — Disconnect is the only one", () => {
    const accountSheet = readFileSync(
      resolve(process.cwd(), "src/components/account/account-sheet.tsx"),
      "utf8",
    );
    expect(accountSheet).not.toMatch(/Sign out/i);
    expect(accountSheet.match(/onDisconnect/g)?.length).toBeGreaterThan(0);
  });
});
