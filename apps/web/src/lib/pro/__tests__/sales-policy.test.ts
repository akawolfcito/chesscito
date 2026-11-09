import { expect, it } from "vitest";
import { isProSalesEnabled } from "../sales-policy";

it("keeps new PRO sales paused independently of existing entitlement reads", () => {
  expect(isProSalesEnabled()).toBe(false);
});
