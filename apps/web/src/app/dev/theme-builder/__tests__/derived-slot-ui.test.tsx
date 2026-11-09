import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { UploadControl } from "../upload-control";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UploadControl on a derived slot", () => {
  function renderDerived() {
    render(
      <UploadControl
        themeId="candy-forest"
        slotKey="brand.favicon-ico"
        variant="default"
        mode="asset"
        hasBackup
        derivedFrom="brand.favicon"
      />,
    );
  }

  it("names the slot it is generated from", () => {
    renderDerived();
    expect(screen.getByText(/derived from brand\.favicon/i)).toBeInTheDocument();
  });

  it("offers no way to replace, revert or change its mode", () => {
    renderDerived();
    expect(screen.queryByRole("button", { name: /replace/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /undo/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /none/i })).toBeNull();
    // hasBackup is true above on purpose: an Undo that the API refuses with
    // 400 must not be offered just because a backup happens to exist.
  });

  it("still offers the controls on an ordinary slot", () => {
    render(
      <UploadControl
        themeId="candy-forest"
        slotKey="hub.portal"
        variant="default"
        mode="asset"
        hasBackup
      />,
    );
    expect(screen.getByRole("button", { name: /replace/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();
  });
});

describe("UploadControl derivation reporting", () => {
  async function uploadTo(slotKey: string) {
    render(
      <UploadControl
        themeId="candy-forest"
        slotKey={slotKey}
        variant="default"
        mode="asset"
        hasBackup={false}
      />,
    );
    const input = screen.getByLabelText(/replacement image/i);
    await userEvent.upload(
      input,
      new File(["x"], "wolf.png", { type: "image/png" }),
    );
  }

  it("warns when the replace succeeded but the icons did not regenerate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ok: true,
          basename: "/art/favicon-wolf",
          width: 1254,
          height: 1254,
          derived: { ok: false, error: "disk on fire" },
        }),
      ),
    );

    await uploadTo("brand.favicon");

    await waitFor(() => {
      expect(screen.getByText(/saved · 1254×1254/)).toBeInTheDocument();
    });
    // Both halves matter: the save succeeded AND the icons are stale.
    expect(screen.getByText(/icons not regenerated/i)).toBeInTheDocument();
    expect(screen.getByText(/disk on fire/)).toBeInTheDocument();
    expect(screen.getByText(/pnpm icons:generate/)).toBeInTheDocument();
  });

  it("reports how many icons were written on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ok: true,
          basename: "/art/favicon-wolf",
          width: 1254,
          height: 1254,
          derived: {
            ok: true,
            files: [
              "landing/public/favicon.ico",
              "landing/public/apple-icon.png",
              "web/src/app/favicon.ico",
              "web/src/app/apple-icon.png",
              "web/src/app/icon.png",
            ],
          },
        }),
      ),
    );

    await uploadTo("brand.favicon");

    await waitFor(() => {
      expect(screen.getByText(/5 brand icons regenerated/i)).toBeInTheDocument();
    });
  });

  it("says nothing about icons for a slot that derives none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ ok: true, basename: "/art/x", width: 10, height: 10 }),
      ),
    );

    await uploadTo("hub.portal");

    await waitFor(() => {
      expect(screen.getByText(/saved · 10×10/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/icons/i)).toBeNull();
  });
});
