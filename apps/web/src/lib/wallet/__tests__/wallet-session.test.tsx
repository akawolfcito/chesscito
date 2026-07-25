import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const disconnect = vi.hoisted(() => vi.fn());

vi.mock("wagmi", () => ({ useDisconnect: () => ({ disconnect }) }));

import { WalletSessionProvider, useWalletSignOut } from "@/lib/wallet/wallet-session";

function SignOutButton() {
  const signOut = useWalletSignOut();
  return (
    <button type="button" onClick={() => signOut()}>
      sign out
    </button>
  );
}

beforeEach(() => {
  disconnect.mockReset();
});

describe("useWalletSignOut", () => {
  it("falls back to the wagmi disconnect when no branch supplies a session", async () => {
    // The injected/MiniPay branch — and the whole app with
    // NEXT_PUBLIC_PRIVY_ENABLED=false — mounts no WalletSessionProvider. The
    // hook must then behave exactly like the `disconnect()` call that shipped
    // before Privy existed.
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "sign out" }));

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("uses the branch session when one is supplied, instead of wagmi", async () => {
    const signOut = vi.fn();
    render(
      <WalletSessionProvider signOut={signOut}>
        <SignOutButton />
      </WalletSessionProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "sign out" }));

    expect(signOut).toHaveBeenCalledTimes(1);
    // Dropping only the wagmi connector would leave the Privy session alive.
    expect(disconnect).not.toHaveBeenCalled();
  });
});
