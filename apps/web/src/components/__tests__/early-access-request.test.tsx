/**
 * EarlyAccessRequest — the intake screen.
 *
 * The load-bearing property, asserted first and repeatedly: this screen never
 * touches Privy. A login creates a session, a session is a MAU, and the Core
 * plan is free only to 499 of them — so ASKING for a key must cost nothing.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const trackMock = vi.fn();

vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

vi.mock("@/lib/analytics/attribution", () => ({
  getAttribution: () => ({ source: "web_early_access", campaign: null }),
}));

import { EarlyAccessRequest } from "@/components/early-access-request";
import { EARLY_ACCESS_COPY } from "@/lib/wallet/web-access-copy";

const onBack = vi.fn();

function renderScreen() {
  return render(<EarlyAccessRequest surface="learn" onBack={onBack} />);
}

function mockFetch(response: { ok: boolean; body?: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    json: async () => response.body ?? {},
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Renders the screen, fills the field and submits. Renders here rather than in
 *  each test so a `fetch` double set up first is always the one in effect. */
async function submitEmail(value: string) {
  const user = userEvent.setup();
  renderScreen();
  await user.type(screen.getByLabelText(EARLY_ACCESS_COPY.request.emailLabel), value);
  await user.click(screen.getByRole("button", { name: EARLY_ACCESS_COPY.request.cta }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mockFetch({ ok: true, body: { ok: true, outcome: "created" } });
});

describe("no Privy resource is consumed", () => {
  it("posts to our own route and nowhere else", async () => {
    const fetchMock = mockFetch({ ok: true, body: { ok: true, outcome: "created" } });

    await submitEmail("ana@example.com");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/early-access/request");
    // Nothing may reach auth.privy.io from the intake path: that is the whole
    // reason this screen sits in FRONT of the gate instead of behind it.
    expect(String(url)).not.toContain("privy");
  });
});

describe("requesting a key", () => {
  it("sends the normalized email and the existing attribution source", async () => {
    const fetchMock = mockFetch({ ok: true, body: { ok: true, outcome: "created" } });

    await submitEmail("  Ana@Example.COM  ");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: "ana@example.com",
      source: "web_early_access",
    });
  });

  it("shows the confirmation, and no second request CTA", async () => {
    await submitEmail("ana@example.com");

    expect(await screen.findByText(EARLY_ACCESS_COPY.waiting.title)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: EARLY_ACCESS_COPY.request.cta }),
    ).not.toBeInTheDocument();
  });

  it("shows the SAME confirmation for a repeat request", async () => {
    mockFetch({ ok: true, body: { ok: true, outcome: "already-requested" } });

    await submitEmail("ana@example.com");

    // Telling somebody "you already asked" helps nobody and reads as a rebuke.
    expect(await screen.findByText(EARLY_ACCESS_COPY.waiting.title)).toBeInTheDocument();
  });

  it("never says denied, error, or not allowed", async () => {
    const { container } = renderScreen();

    expect(container.textContent?.toLowerCase()).not.toMatch(
      /denied|not allowed|forbidden|rejected|unauthorized/,
    );
  });
});

describe("failures stay about the form, not the player", () => {
  it("rejects a malformed email client-side without calling the server", async () => {
    const fetchMock = mockFetch({ ok: true });

    await submitEmail("anaexample.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      EARLY_ACCESS_COPY.request.invalid,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a server failure and keeps the CTA armed for a retry", async () => {
    mockFetch({ ok: false });

    await submitEmail("ana@example.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      EARLY_ACCESS_COPY.request.failed,
    );
    expect(
      screen.getByRole("button", { name: EARLY_ACCESS_COPY.request.cta }),
    ).toBeEnabled();
  });

  it("survives a network throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await submitEmail("ana@example.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      EARLY_ACCESS_COPY.request.failed,
    );
  });
});

describe("telemetry is PII-free and provable", () => {
  it("reports the view once per mount", async () => {
    renderScreen();

    const views = trackMock.mock.calls.filter(
      ([event]) => event === "web_early_access_request_viewed",
    );
    expect(views).toHaveLength(1);
    expect(views[0][1]).toEqual({ surface: "learn" });
  });

  it("reports the request with its outcome", async () => {
    mockFetch({ ok: true, body: { ok: true, outcome: "already-requested" } });

    await submitEmail("ana@example.com");

    await waitFor(() =>
      expect(trackMock).toHaveBeenCalledWith("web_early_access_requested", {
        surface: "learn",
        outcome: "already-requested",
      }),
    );
  });

  it("NEVER puts the email in an event", async () => {
    await submitEmail("ana@example.com");

    await waitFor(() =>
      expect(trackMock).toHaveBeenCalledWith(
        "web_early_access_requested",
        expect.anything(),
      ),
    );
    const serialized = JSON.stringify(trackMock.mock.calls);
    expect(serialized).not.toContain("ana@example.com");
    expect(serialized).not.toContain("ana");
  });

  it("emits no approved-entry event — it could not be proven true", async () => {
    await submitEmail("ana@example.com");

    await waitFor(() => expect(trackMock).toHaveBeenCalled());
    const events = trackMock.mock.calls.map(([event]) => event);
    // A browser user who authenticates may be a legacy web user Privy still
    // admits by design; the client cannot tell them apart, so labelling that
    // entry as Early Access would overcount this funnel's own success.
    expect(events).not.toContain("web_early_access_approved_entry");
  });
});

describe("back", () => {
  it("returns to the gate from the form", async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: EARLY_ACCESS_COPY.request.back }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("returns to the gate from the confirmation", async () => {
    const user = await submitEmail("ana@example.com");
    await screen.findByText(EARLY_ACCESS_COPY.waiting.title);

    await user.click(screen.getByRole("button", { name: EARLY_ACCESS_COPY.waiting.back }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
