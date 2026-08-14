/**
 * The login budget, at the one place it can still save money.
 *
 * ⛔ THE ASSERTION THAT MATTERS IS ABOUT `login()`, NOT ABOUT THE SCREEN.
 * Privy counts a MAU when it refreshes a session, so a cap that runs after
 * `login()` has already spent exactly what it was protecting. Every test here
 * therefore asserts on the Privy hook — a check that only changed the UI would
 * pass a screenshot and still pay the invoice.
 *
 * ⚠️ And the door opens when in doubt: a failed fetch, a non-200, a body we
 * cannot read. The cap is a BUDGET. The real gate is Privy's allowlist, which
 * is server-side and does not depend on this file being reachable.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

type LoginCallbacks = { onComplete?: () => void; onError?: (code: string) => void };

let readyMock = true;
let authenticatedMock = false;
let addressMock: string | undefined = undefined;
const loginMock = vi.fn();
const trackMock = vi.fn();
const fetchMock = vi.fn();

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
import { EARLY_ACCESS_COPY, WEB_ACCESS_COPY } from "@/lib/wallet/web-access-copy";
import { WEB_ACCESS_EVENTS } from "@/lib/wallet/web-access-analytics";

const CHILD = "productive-children";

function renderGate() {
  return render(
    <WebAccessGate surface="learn">
      <div>{CHILD}</div>
    </WebAccessGate>,
  );
}

/** The capacity route answering `open`. */
function capacitySays(open: boolean) {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ open }) });
}

async function pressEnter() {
  await userEvent.click(screen.getByRole("button", { name: WEB_ACCESS_COPY.cta }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  capacitySays(true);
  readyMock = true;
  authenticatedMock = false;
  addressMock = undefined;
});

describe("with room left", () => {
  it("logs in as it always did", async () => {
    renderGate();

    await pressEnter();

    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
  });

  it("asks the server, never the client, whether there is room", async () => {
    renderGate();

    await pressEnter();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/access/capacity");
  });

  it("checks BEFORE spending the login", async () => {
    const order: string[] = [];
    fetchMock.mockImplementation(async () => {
      order.push("capacity");
      return { ok: true, json: async () => ({ open: true }) };
    });
    loginMock.mockImplementation(() => order.push("login"));
    renderGate();

    await pressEnter();

    await waitFor(() => expect(order).toEqual(["capacity", "login"]));
  });
});

describe("when the budget is spent", () => {
  beforeEach(() => capacitySays(false));

  it("does not call login()", async () => {
    renderGate();

    await pressEnter();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("shows the waitlist that already exists, not an error", async () => {
    renderGate();

    await pressEnter();

    // The intake's own copy already carries the right tone for this moment
    // ("opening gradually to small groups"), so being full needs no new screen
    // and no new sentence about being turned away.
    expect(
      await screen.findByText(EARLY_ACCESS_COPY.request.title),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not report a login it never started", async () => {
    renderGate();

    await pressEnter();

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const events = trackMock.mock.calls.map(([event]) => event);
    expect(events).not.toContain(WEB_ACCESS_EVENTS.loginStarted);
  });

  it("leaves the CTA usable again after bouncing to the waitlist", async () => {
    // A gate stuck on `authenticating` after a refusal would strand the visitor
    // on a disabled button with nothing in flight.
    renderGate();

    await pressEnter();

    await screen.findByText(EARLY_ACCESS_COPY.request.title);
    await userEvent.click(
      screen.getByRole("button", { name: EARLY_ACCESS_COPY.request.back }),
    );
    expect(
      screen.getByRole("button", { name: WEB_ACCESS_COPY.cta }),
    ).toBeEnabled();
  });
});

describe("when in doubt, the door opens", () => {
  it("logs in when the capacity request rejects", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    renderGate();

    await pressEnter();

    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
  });

  it("logs in when the route answers non-200", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "rate_limited" }) });
    renderGate();

    await pressEnter();

    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
  });

  it("logs in when the body is not the shape we expect", async () => {
    // Only an explicit `open: false` closes. Anything else is an unanswered
    // question, and an unanswered question must not lock the product.
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    renderGate();

    await pressEnter();

    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
  });

  it("logs in when the body is not JSON at all", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("not json");
      },
    });
    renderGate();

    await pressEnter();

    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
  });
});

describe("who the cap never touches", () => {
  it("lets an existing session straight through without asking", async () => {
    // Closing the door on somebody already inside saves nothing — their MAU is
    // already counted — and breaks the product for them.
    authenticatedMock = true;
    addressMock = "0xabc";
    capacitySays(false);

    renderGate();

    expect(screen.getByText(CHILD)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never asks before the visitor presses ENTER", async () => {
    // The check is an action of the CTA, not of mounting: a fetch per gate view
    // would spend a request on every visitor who never logs in.
    renderGate();

    await screen.findByRole("button", { name: WEB_ACCESS_COPY.cta });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
