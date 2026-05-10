import { describe, it, expect, vi, beforeEach } from "vitest";

/** Phase 7 commit a — `?hub=v2` flag mechanics (design-lock §7 + §9.5).
 *
 *  Asserts the four-cell activation matrix from §7.1 plus the
 *  server-side render contract from §7.3 (no client flicker). The
 *  default-on branch (rows 2 + 4 of the matrix) is exercised by mocking
 *  `HUB_V2_DEFAULT = true`; production stays default-off until Phase 8.
 *
 *  Unit-under-test is the page server-component returning JSX
 *  synchronously based on `searchParams`. Both scaffolds are mocked to
 *  bare object stubs so the test stays in the routing layer and never
 *  touches wagmi / RainbowKit deps. */

const redirectMock = vi.hoisted(() =>
  vi.fn((_url: string): never => {
    throw new Error("REDIRECT");
  }),
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/components/hub/hub-scaffold-client", () => ({
  HubScaffoldClient: () => ({ type: "HubScaffoldClient", props: {} }),
}));

vi.mock("@/components/hub/hub-scaffold-v2-client", () => ({
  HubScaffoldV2Client: () => ({ type: "HubScaffoldV2Client", props: {} }),
}));

type RenderedElement = {
  type: { name?: string };
  props: Record<string, unknown>;
};

function nameOf(el: unknown): string | undefined {
  return (el as RenderedElement | undefined)?.type?.name;
}

describe("hub flag resolution — default-off (HUB_V2_DEFAULT=false)", () => {
  beforeEach(() => {
    vi.resetModules();
    redirectMock.mockClear();
  });

  it("`?hub=v2` overrides default-off → renders V2", async () => {
    const HubPage = (await import("../page")).default;
    const el = HubPage({ searchParams: { hub: "v2" } });
    expect(nameOf(el)).toBe("HubScaffoldV2Client");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("passes `?sheet=` through when rendering V2", async () => {
    const HubPage = (await import("../page")).default;
    const el = HubPage({ searchParams: { hub: "v2", sheet: "badges" } });
    expect(nameOf(el)).toBe("HubScaffoldV2Client");
    expect((el as RenderedElement).props.initialSheet).toBe("badges");
  });

  it("no query + default-off → renders V1", async () => {
    const HubPage = (await import("../page")).default;
    const el = HubPage({ searchParams: {} });
    expect(nameOf(el)).toBe("HubScaffoldClient");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("server-side resolution: returns JSX synchronously, no client flicker", async () => {
    const HubPage = (await import("../page")).default;
    const v2El = HubPage({ searchParams: { hub: "v2" } });
    const v1El = HubPage({ searchParams: {} });
    // Sync return = no Promise, no Suspense fallback path, no useEffect-based decision.
    expect(v2El).not.toBeInstanceOf(Promise);
    expect(v1El).not.toBeInstanceOf(Promise);
    expect(nameOf(v2El)).toBe("HubScaffoldV2Client");
    expect(nameOf(v1El)).toBe("HubScaffoldClient");
  });
});

describe("hub flag resolution — default-on (HUB_V2_DEFAULT=true, mocked)", () => {
  beforeEach(() => {
    vi.resetModules();
    redirectMock.mockClear();
    vi.doMock("@/lib/feature-flags", async () => {
      const actual = await vi.importActual<
        typeof import("@/lib/feature-flags")
      >("@/lib/feature-flags");
      return {
        ...actual,
        HUB_V2_DEFAULT: true,
      };
    });
  });

  it("`?hub=v1` overrides default-on → renders V1 (escape hatch)", async () => {
    const HubPage = (await import("../page")).default;
    const el = HubPage({ searchParams: { hub: "v1" } });
    expect(nameOf(el)).toBe("HubScaffoldClient");
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("no query + default-on → renders V2", async () => {
    const HubPage = (await import("../page")).default;
    const el = HubPage({ searchParams: {} });
    expect(nameOf(el)).toBe("HubScaffoldV2Client");
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
