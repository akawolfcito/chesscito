import { describe, expect, it, vi } from "vitest";

import {
  PRODUCT_CONNECTION_ORIGINS,
  preconnectProductOrigins,
} from "../connection-hints";

describe("landing product connection hints", () => {
  it("warms exactly the Learn and Play origins used by the landing exit", () => {
    const connect = vi.fn();

    preconnectProductOrigins(connect);

    expect(PRODUCT_CONNECTION_ORIGINS).toEqual([
      "https://learn.chesscito.com",
      "https://play.chesscito.com",
    ]);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(connect).toHaveBeenNthCalledWith(
      1,
      "https://learn.chesscito.com",
      { crossOrigin: "anonymous" },
    );
    expect(connect).toHaveBeenNthCalledWith(
      2,
      "https://play.chesscito.com",
      { crossOrigin: "anonymous" },
    );
  });
});
