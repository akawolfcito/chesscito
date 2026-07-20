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

import { POST } from "../route";

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
