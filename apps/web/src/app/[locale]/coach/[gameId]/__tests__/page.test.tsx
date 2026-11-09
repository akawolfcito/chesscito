import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const read = vi.hoisted(() => vi.fn(() => { throw new Error("SSR must not read private records"); }));
vi.mock("@/lib/server/redis", () => ({ getRedis: read }));
vi.mock("@/components/coach/private-game-reader", () => ({ PrivateGameReader: () => <div>Private reader</div> }));
vi.mock("@/components/coach/game-viewer", () => ({ GameViewer: () => null }));
import Page from "../page";

describe("private game page server output", () => {
  it("renders only a reader shell, without loading data selected by URL wallet", async () => {
    const page = await Page({
      params: Promise.resolve({ locale: "en", gameId: "550e8400-e29b-41d4-a716-446655440000" }),
      searchParams: Promise.resolve({ wallet: `0x${"1".repeat(40)}` }),
    });
    expect(renderToStaticMarkup(page)).toContain("Private reader");
    expect(read).not.toHaveBeenCalled();
  });
});
