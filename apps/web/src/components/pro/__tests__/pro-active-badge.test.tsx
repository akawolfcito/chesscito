import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { ProActiveBadge } from "../pro-active-badge";
import { PRO_COPY } from "@/lib/content/editorial";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

afterEach(() => {
  cleanup();
});

describe("ProActiveBadge", () => {
  it("renders the ACTIVE pill when daysLeft > 3", () => {
    render(<ProActiveBadge expiresAtMs={NOW + 10 * MS_PER_DAY} nowMs={NOW} />);
    expect(screen.getByTestId("pro-active-badge-pill")).toHaveTextContent(
      PRO_COPY.statusBadgeActive,
    );
  });

  it("renders the EXPIRING pill when daysLeft <= 3", () => {
    render(<ProActiveBadge expiresAtMs={NOW + 2 * MS_PER_DAY} nowMs={NOW} />);
    expect(screen.getByTestId("pro-active-badge-pill")).toHaveTextContent(
      PRO_COPY.statusBadgeExpiring,
    );
  });

  it("renders the counter using statusActiveSuffix for plural days", () => {
    render(<ProActiveBadge expiresAtMs={NOW + 10 * MS_PER_DAY} nowMs={NOW} />);
    expect(screen.getByTestId("pro-active-badge-counter")).toHaveTextContent(
      PRO_COPY.statusActiveSuffix(10),
    );
  });

  it("renders the 'Expires tomorrow' counter when 1 day remains", () => {
    render(<ProActiveBadge expiresAtMs={NOW + 12 * 60 * 60 * 1000} nowMs={NOW} />);
    expect(screen.getByTestId("pro-active-badge-counter")).toHaveTextContent(
      PRO_COPY.statusActiveSuffix(1),
    );
  });

  it("clamps daysLeft to a minimum of 1 when expiry is in the past", () => {
    render(<ProActiveBadge expiresAtMs={NOW - 5 * MS_PER_DAY} nowMs={NOW} />);
    expect(screen.getByTestId("pro-active-badge-counter")).toHaveTextContent(
      PRO_COPY.statusActiveSuffix(1),
    );
  });

  it("uses the EXPIRING variant at the boundary daysLeft === 3", () => {
    render(<ProActiveBadge expiresAtMs={NOW + 3 * MS_PER_DAY} nowMs={NOW} />);
    expect(screen.getByTestId("pro-active-badge-pill")).toHaveTextContent(
      PRO_COPY.statusBadgeExpiring,
    );
  });
});
