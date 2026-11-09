/**
 * Early Access inside the gate — reachability, and the two non-interference
 * guarantees this whole feature was allowed to exist under:
 *
 *   1. MiniPay must never see any of it.
 *   2. The running E0 activation experiment must be untouched.
 *
 * The MiniPay guarantee is structural, not behavioural, and the tests say so:
 * `WebAccessGate` only exists inside `WebWalletProvider` (the Privy branch), and
 * the branch resolver keeps MiniPay on the `injected` tree. There is no render
 * of this component from MiniPay to assert against — the assertion is that the
 * resolver never sends MiniPay to the tree that contains it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

type LoginCallbacks = { onComplete?: () => void; onError?: (code: string) => void };

let readyMock = true;
let authenticatedMock = false;
let addressMock: string | undefined = undefined;
const loginMock = vi.fn();
const trackMock = vi.fn();

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({ ready: readyMock, authenticated: authenticatedMock }),
  useLogin: (_callbacks?: LoginCallbacks) => ({ login: loginMock }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: addressMock }),
}));

vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/hub",
}));

vi.mock("@/lib/analytics/attribution", () => ({
  getAttribution: () => ({ source: "direct", campaign: null }),
}));

import { WebAccessGate } from "@/components/web-access-gate";
import { resolveWalletBranch } from "@/lib/wallet/wallet-branch";
import { EARLY_ACCESS_COPY, WEB_ACCESS_COPY } from "@/lib/wallet/web-access-copy";

const CHILD = "productive-children";
const SRC = join(__dirname, "..", "..");

function renderGate() {
  return render(
    <WebAccessGate surface="learn">
      <div>{CHILD}</div>
    </WebAccessGate>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ outcome: "created" }) }),
  );
  readyMock = true;
  authenticatedMock = false;
  addressMock = undefined;
});

describe("reaching the intake from ENTER", () => {
  it("keeps the ENTER screen exactly as it was, with the request link secondary", () => {
    renderGate();

    // The primary CTA is untouched: a player who already has a key sees the
    // screen they have always seen.
    expect(screen.getByRole("button", { name: WEB_ACCESS_COPY.cta })).toBeInTheDocument();
    expect(screen.getByText(WEB_ACCESS_COPY.headline)).toBeInTheDocument();
    // …and there is no permanent email field competing with it.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: EARLY_ACCESS_COPY.requestLink }),
    ).toBeInTheDocument();
  });

  it("opens the intake without calling login() — no Privy resource is consumed", async () => {
    const user = userEvent.setup();
    renderGate();

    await user.click(screen.getByRole("button", { name: EARLY_ACCESS_COPY.requestLink }));

    expect(screen.getByText(EARLY_ACCESS_COPY.request.title)).toBeInTheDocument();
    // The entire point of putting the intake in FRONT of the gate: a login is
    // a session, a session is a MAU, and the free tier is 499 of them.
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("returns to the gate from the intake", async () => {
    const user = userEvent.setup();
    renderGate();

    await user.click(screen.getByRole("button", { name: EARLY_ACCESS_COPY.requestLink }));
    await user.click(screen.getByRole("button", { name: EARLY_ACCESS_COPY.request.back }));

    expect(screen.getByRole("button", { name: WEB_ACCESS_COPY.cta })).toBeInTheDocument();
  });
});

describe("the intake never covers a productive screen", () => {
  it("an authenticated player with a ready wallet gets the app, never the intake", () => {
    authenticatedMock = true;
    addressMock = "0xabc";

    renderGate();

    expect(screen.getByText(CHILD)).toBeInTheDocument();
    expect(screen.queryByText(EARLY_ACCESS_COPY.request.title)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: EARLY_ACCESS_COPY.requestLink }),
    ).not.toBeInTheDocument();
  });

  it("is unreachable while the wallet is still being provisioned", () => {
    authenticatedMock = true;
    addressMock = undefined;

    renderGate();

    expect(
      screen.queryByRole("button", { name: EARLY_ACCESS_COPY.requestLink }),
    ).not.toBeInTheDocument();
  });
});

describe("MiniPay non-interference", () => {
  it("MiniPay resolves to the injected branch, which does not contain the gate", () => {
    expect(
      resolveWalletBranch({ privyEnabled: true, hydrated: true, isMiniPay: true }),
    ).toBe("injected");
    // With the Privy flag off, nobody reaches the Privy tree at all.
    expect(
      resolveWalletBranch({ privyEnabled: false, hydrated: true, isMiniPay: false }),
    ).toBe("injected");
  });

  it("only the Privy provider mounts the gate that hosts the intake", () => {
    const privyTree = readFileSync(join(SRC, "components/web-wallet-provider.tsx"), "utf8");
    const injectedTree = readFileSync(join(SRC, "components/wallet-provider.tsx"), "utf8");

    expect(privyTree).toContain("WebAccessGate");
    // If this ever fails, MiniPay has been given a door to a screen that asks
    // for an email it does not need — and the branch isolation is gone.
    expect(injectedTree).not.toContain("WebAccessGate");
    expect(injectedTree).not.toContain("EarlyAccessRequest");
    expect(injectedTree).not.toContain("early-access");
  });
});

describe("E0 non-interference", () => {
  /** The running experiment: `lib/onboarding/first-activity-experiment.ts` +
   *  its telemetry. Early Access must not read it, write it, or import it. */
  const EARLY_ACCESS_FILES = [
    "lib/early-access/request.ts",
    "lib/server/early-access-store.ts",
    "lib/server/early-access-origin.ts",
    "components/early-access-request.tsx",
    "app/api/early-access/request/route.ts",
  ];

  it.each(EARLY_ACCESS_FILES)("%s imports nothing from the experiment", (file) => {
    const source = readFileSync(join(SRC, file), "utf8");

    expect(source).not.toContain("lib/onboarding");
    expect(source).not.toContain("first-activity");
    expect(source).not.toContain("onboarding_variant");
  });

  it("the experiment imports nothing from Early Access", () => {
    const experiment = readFileSync(
      join(SRC, "lib/onboarding/first-activity-experiment.ts"),
      "utf8",
    );

    expect(experiment).not.toContain("early-access");
    expect(experiment).not.toContain("early_access");
  });

  it("Early Access emits no event E0 reads, and reuses no E0 event name", () => {
    const analytics = readFileSync(join(SRC, "lib/wallet/web-access-analytics.ts"), "utf8");
    const telemetry = readFileSync(join(SRC, "lib/onboarding/telemetry.ts"), "utf8");

    // Every Early Access event carries its own prefix; none of them appears in
    // the experiment's telemetry module, so no analysis can pick one up by
    // name and read it as activation.
    for (const event of analytics.match(/web_early_access_[a-z_]+/g) ?? []) {
      expect(telemetry).not.toContain(event);
    }
  });
});
