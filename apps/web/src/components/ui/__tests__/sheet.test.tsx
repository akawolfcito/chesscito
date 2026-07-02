import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { Sheet, SheetContent } from "../sheet";

afterEach(() => {
  cleanup();
});

describe("SheetContent — overlayClassName override", () => {
  it("forwards overlayClassName to the underlying SheetOverlay, replacing the default z-50", () => {
    const { baseElement } = render(
      <Sheet open>
        <SheetContent title="Test sheet" overlayClassName="z-[70]">
          content
        </SheetContent>
      </Sheet>,
    );

    const dialog = baseElement.querySelector('[role="dialog"]');
    const overlay = dialog?.previousElementSibling as HTMLElement | null;

    expect(overlay).not.toBeNull();
    expect(overlay?.className).toContain("z-[70]");
    expect(overlay?.className).not.toContain("z-50");
  });

  it("keeps the default z-50 overlay when overlayClassName is not passed", () => {
    const { baseElement } = render(
      <Sheet open>
        <SheetContent title="Test sheet">content</SheetContent>
      </Sheet>,
    );

    const dialog = baseElement.querySelector('[role="dialog"]');
    const overlay = dialog?.previousElementSibling as HTMLElement | null;

    expect(overlay?.className).toContain("z-50");
  });
});
