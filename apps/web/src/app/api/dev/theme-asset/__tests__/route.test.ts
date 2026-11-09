import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  class MockAssetFamilyError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    MockAssetFamilyError,
    replace: vi.fn(),
    restore: vi.fn(),
    setRegistry: vi.fn(),
    readUndo: vi.fn(),
    saveUndo: vi.fn(),
    deriveBrandIcons: vi.fn(),
    writeDerivedIcons: vi.fn(),
  };
});

vi.mock("@/lib/dev/dev-surface", () => ({
  isDevSurfaceEnabled: () => true,
  canWriteBaseline: () => true,
}));

vi.mock("@/lib/themes/asset-triplet", () => ({
  AssetFamilyError: mocks.MockAssetFamilyError,
  replaceAssetFamilyAtomic: mocks.replace,
  restorePreviousAssetFamilyAtomic: mocks.restore,
}));

vi.mock("@/lib/themes/registry-editor", () => ({
  setRegistryVariant: mocks.setRegistry,
}));

vi.mock("@/lib/themes/variant-undo", () => ({
  readVariantUndo: mocks.readUndo,
  saveVariantUndo: mocks.saveUndo,
}));

vi.mock("@/lib/themes/icon-derivation", () => ({
  deriveBrandIcons: mocks.deriveBrandIcons,
}));

vi.mock("@/lib/themes/derived-icons-writer", () => ({
  writeDerivedIcons: mocks.writeDerivedIcons,
}));

import { GET, POST } from "../route";
import { resolveAppRoot } from "@/lib/themes/asset-roots";

function uploadRequest(): Request {
  const form = new FormData();
  form.set("themeId", "candy-forest");
  form.set("key", "hub.avatar-lite");
  form.set("variant", "default");
  form.set("file", new File(["image"], "avatar.png", { type: "image/png" }));
  return { formData: async () => form } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.replace.mockImplementation(async (options) => {
    await options.afterPromote?.();
    await options.persistUndoState?.();
    return {
      files: [
        "/art/avatar-lite-hub.png",
        "/art/avatar-lite-hub.webp",
        "/art/avatar-lite-hub.avif",
        "/art/avatar-lite-hub-224w.webp",
        "/art/avatar-lite-hub-224w.avif",
        "/art/avatar-lite-hub-340w.webp",
        "/art/avatar-lite-hub-340w.avif",
      ],
      width: 499,
      height: 560,
      responsiveWidths: [224, 340],
      sourceSignature: "a".repeat(64),
    };
  });
  mocks.restore.mockResolvedValue({ ok: true, restored: [] });
  mocks.readUndo.mockResolvedValue(null);
  mocks.saveUndo.mockResolvedValue(undefined);
  mocks.setRegistry.mockResolvedValue(undefined);
  mocks.deriveBrandIcons.mockResolvedValue([]);
  mocks.writeDerivedIcons.mockResolvedValue({ ok: true, files: [] });
});

describe("POST /api/dev/theme-asset", () => {
  it("passes responsive metadata and reports the complete generated family", async () => {
    const response = await POST(uploadRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.files).toHaveLength(7);
    expect(body.responsiveWidths).toEqual([224, 340]);
    expect(mocks.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        basename: "/art/avatar-lite-hub",
        profile: {
          widths: [224, 340],
          canonical: { width: 499, height: 560 },
        },
        persistUndoState: expect.any(Function),
      }),
    );
    expect(mocks.saveUndo).toHaveBeenCalledWith(
      "candy-forest",
      "hub.avatar-lite",
      "default",
      expect.objectContaining({ restoreFamily: true }),
    );
  });

  it("returns a specific non-success response for an undersized source", async () => {
    mocks.replace.mockRejectedValueOnce(
      new mocks.MockAssetFamilyError("source-too-small", "too small"),
    );
    const response = await POST(uploadRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      ok: false,
      code: "source-too-small",
      error: "source image is too small for this responsive slot",
    });
    expect(mocks.saveUndo).not.toHaveBeenCalled();
  });

  it("undo delegates to the complete family snapshot", async () => {
    mocks.readUndo.mockResolvedValueOnce({
      previous: { mode: "asset", path: "/art/avatar-lite-hub" },
      basename: "/art/avatar-lite-hub",
      restoreFamily: true,
      restoreRegistry: false,
    });
    mocks.restore.mockResolvedValueOnce({
      ok: true,
      restored: [
        "/art/avatar-lite-hub.png",
        "/art/avatar-lite-hub-224w.avif",
        "/art/avatar-lite-hub-340w.avif",
      ],
    });
    const form = new FormData();
    form.set("themeId", "candy-forest");
    form.set("key", "hub.avatar-lite");
    form.set("variant", "default");
    form.set("action", "undo");
    const response = await POST({ formData: async () => form } as unknown as Request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.restored).toContain("/art/avatar-lite-hub-340w.avif");
    expect(mocks.restore).toHaveBeenCalledWith(
      expect.objectContaining({ basename: "/art/avatar-lite-hub" }),
    );
  });

  it("writes a web-owned slot into the web app", async () => {
    await POST(uploadRequest());
    expect(mocks.replace).toHaveBeenCalledWith(
      expect.objectContaining({ rootDir: resolveAppRoot("web") }),
    );
  });

  it("writes a landing-owned slot into apps/landing, not apps/web", async () => {
    // The regression this guards: /art/... exists in BOTH apps, so a write
    // without a root silently lands in the wrong one and the founder sees
    // no change on the live landing.
    const form = new FormData();
    form.set("themeId", "candy-forest");
    form.set("key", "landing.slide1-bg");
    form.set("variant", "default");
    form.set("file", new File(["image"], "slide.png", { type: "image/png" }));
    const response = await POST({ formData: async () => form } as unknown as Request);

    expect(response.status).toBe(200);
    expect(mocks.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        basename: "/art/landing-slides/slide-bg-1",
        rootDir: resolveAppRoot("landing"),
      }),
    );
    expect(resolveAppRoot("landing")).not.toBe(resolveAppRoot("web"));
  });

  it("undo restores from the same app it wrote to", async () => {
    mocks.readUndo.mockResolvedValueOnce({
      previous: { mode: "asset", path: "/art/landing-slides/title-chesscito" },
      basename: "/art/landing-slides/title-chesscito",
      restoreFamily: true,
      restoreRegistry: false,
    });
    const form = new FormData();
    form.set("themeId", "candy-forest");
    form.set("key", "landing.slide1-title");
    form.set("variant", "default");
    form.set("action", "undo");
    await POST({ formData: async () => form } as unknown as Request);

    expect(mocks.restore).toHaveBeenCalledWith(
      expect.objectContaining({ rootDir: resolveAppRoot("landing") }),
    );
  });

  it("rolls a mode change back when undo metadata cannot be persisted", async () => {
    mocks.saveUndo.mockRejectedValueOnce(new Error("injected metadata failure"));
    const form = new FormData();
    form.set("themeId", "candy-forest");
    form.set("key", "hub.avatar-lite");
    form.set("variant", "default");
    form.set("action", "set-mode");
    form.set("mode", "none");

    const response = await POST({ formData: async () => form } as unknown as Request);
    expect(response.status).toBe(500);
    expect(mocks.setRegistry).toHaveBeenNthCalledWith(
      1,
      "candy-forest",
      "hub.avatar-lite",
      "default",
      { mode: "none" },
    );
    expect(mocks.setRegistry).toHaveBeenNthCalledWith(
      2,
      "candy-forest",
      "hub.avatar-lite",
      "default",
      { mode: "asset", path: "/art/avatar-lite-hub" },
    );
  });
});

describe("brand icon derivation on replace", () => {
  function replaceWolf(variant = "default"): Request {
    const form = new FormData();
    form.set("themeId", "candy-forest");
    form.set("key", "brand.favicon");
    form.set("variant", variant);
    form.set("file", new File(["wolf"], "wolf.png", { type: "image/png" }));
    return { formData: async () => form } as unknown as Request;
  }

  it("derives and reports the files after replacing the wolf master", async () => {
    mocks.writeDerivedIcons.mockResolvedValueOnce({
      ok: true,
      files: ["landing/public/favicon.ico", "web/src/app/icon.png"],
    });
    const response = await POST(replaceWolf());
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.derived).toEqual({
      ok: true,
      files: ["landing/public/favicon.ico", "web/src/app/icon.png"],
    });
  });

  it("derives from the uploaded bytes, not from what is on disk", async () => {
    await POST(replaceWolf());
    expect(mocks.deriveBrandIcons).toHaveBeenCalledWith(
      expect.objectContaining({ length: expect.any(Number) }),
    );
  });

  it("keeps the replace successful when derivation fails", async () => {
    mocks.writeDerivedIcons.mockResolvedValueOnce({ ok: false, error: "disk on fire" });
    const response = await POST(replaceWolf());
    expect(response.status).toBe(200);
    const body = await response.json();
    // The master IS written — reverting a good replace over a bad icon is
    // the worse failure, and icons:generate recovers the icons.
    expect(body.ok).toBe(true);
    expect(body.basename).toBe("/art/favicon-wolf");
    expect(body.derived).toEqual({ ok: false, error: "disk on fire" });
  });

  it("reports a thrown derivation as a failure instead of a 500", async () => {
    mocks.deriveBrandIcons.mockRejectedValueOnce(new Error("sharp exploded"));
    const response = await POST(replaceWolf());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.derived.ok).toBe(false);
    expect(body.derived.error).toMatch(/sharp exploded/);
  });

  it("does not derive when the pro variant is replaced", async () => {
    // A theme's PRO art must not change the browser favicon: these icons are
    // brand, not theme.
    const response = await POST(replaceWolf("pro"));
    expect((await response.json()).derived).toBeUndefined();
    expect(mocks.writeDerivedIcons).not.toHaveBeenCalled();
  });

  it("does not derive for an unrelated slot", async () => {
    const response = await POST(uploadRequest());
    expect((await response.json()).derived).toBeUndefined();
    expect(mocks.writeDerivedIcons).not.toHaveBeenCalled();
  });
});

describe("GET /api/dev/theme-asset", () => {
  function previewRequest(key: string, variant = "default"): Request {
    const query = new URLSearchParams({ themeId: "candy-forest", key, variant });
    return new Request(`http://localhost/api/dev/theme-asset?${query}`);
  }

  it("streams a landing slot the web dev server cannot serve", async () => {
    const response = await GET(previewRequest("landing.slide1-bg"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    // No caching, or a replaced image would keep showing the old bytes.
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("refuses a slot the registry does not declare", async () => {
    const response = await GET(previewRequest("landing.nope"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("refuses an invalid variant instead of guessing a path", async () => {
    const response = await GET(previewRequest("landing.slide1-bg", "ultra"));
    expect(response.status).toBe(400);
  });

  it("serves a single-file slot with its own content type", async () => {
    const response = await GET(previewRequest("landing.og-image"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("serves an .ico slot as an icon, not as a png", async () => {
    const response = await GET(previewRequest("brand.favicon-ico"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/x-icon");
  });
});

describe("derived slots", () => {
  function uploadTo(key: string, variant = "default"): Request {
    const form = new FormData();
    form.set("themeId", "candy-forest");
    form.set("key", key);
    form.set("variant", variant);
    form.set("file", new File(["image"], "icon.png", { type: "image/png" }));
    return { formData: async () => form } as unknown as Request;
  }

  it("refuses an upload to a derived slot with 400", async () => {
    const response = await POST(uploadTo("brand.favicon-ico"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("derived-slot");
    expect(body.error).toMatch(/brand\.favicon/);
  });

  it("does not write anything when it refuses a derived slot", async () => {
    await POST(uploadTo("brand.apple-icon"));
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("passes the wrong-size message through instead of a format complaint", async () => {
    mocks.replace.mockRejectedValueOnce(
      new mocks.MockAssetFamilyError(
        "wrong-dimensions",
        "this slot requires exactly 1200×630px — got 1254×1254px",
      ),
    );
    const form = new FormData();
    form.set("themeId", "candy-forest");
    form.set("key", "landing.og-image");
    form.set("variant", "default");
    form.set("file", new File(["image"], "card.jpg", { type: "image/jpeg" }));

    const response = await POST({ formData: async () => form } as unknown as Request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/1200×630.*1254×1254/);
    expect(body.error).not.toMatch(/decode/i);
  });

  it("hands the writer the slot's declared format and exact size", async () => {
    // The gate itself is enforced in asset-triplet; what this pins is that the
    // registry's declaration actually reaches it. Without this, exactSize is
    // configured on the slot and quietly ignored on every upload.
    const form = new FormData();
    form.set("themeId", "candy-forest");
    form.set("key", "landing.og-image");
    form.set("variant", "default");
    form.set("file", new File(["image"], "card.jpg", { type: "image/jpeg" }));

    await POST({ formData: async () => form } as unknown as Request);
    expect(mocks.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        basename: "/og/chesscito-landing",
        format: "jpg",
        exactSize: { width: 1200, height: 630 },
      }),
    );
  });

  it("leaves format and exact size unset for an ordinary triplet slot", async () => {
    await POST(uploadRequest());
    expect(mocks.replace).toHaveBeenCalledWith(
      expect.objectContaining({ format: undefined, exactSize: null }),
    );
  });

  it("refuses a mode change on a derived slot too", async () => {
    const form = new FormData();
    form.set("themeId", "candy-forest");
    form.set("key", "brand.apple-icon");
    form.set("variant", "default");
    form.set("action", "set-mode");
    form.set("mode", "none");

    const response = await POST({ formData: async () => form } as unknown as Request);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("derived-slot");
    expect(mocks.setRegistry).not.toHaveBeenCalled();
  });
});
