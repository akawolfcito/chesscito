import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  useConnectPrompt,
  type ConnectPromptMilestone,
} from "../use-connect-prompt";

const STORAGE_PREFIX = "chesscito:connect-prompt-shown:";

function storageKey(milestone: ConnectPromptMilestone): string {
  return `${STORAGE_PREFIX}${milestone}`;
}

describe("useConnectPrompt", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts hidden when never shown before", () => {
    const { result } = renderHook(() => useConnectPrompt("stars"));
    expect(result.current.isVisible).toBe(false);
  });

  it("becomes visible after show() the first time and sets the flag", () => {
    const { result } = renderHook(() => useConnectPrompt("stars"));
    act(() => {
      result.current.show();
    });
    expect(result.current.isVisible).toBe(true);
    expect(window.localStorage.getItem(storageKey("stars"))).toBe("1");
  });

  it("becomes hidden after dismiss() but keeps the flag set", () => {
    const { result } = renderHook(() => useConnectPrompt("victory"));
    act(() => {
      result.current.show();
    });
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.isVisible).toBe(false);
    expect(window.localStorage.getItem(storageKey("victory"))).toBe("1");
  });

  it("show() is a no-op when the flag is already set (one-shot per milestone)", () => {
    window.localStorage.setItem(storageKey("badges"), "1");
    const { result } = renderHook(() => useConnectPrompt("badges"));
    act(() => {
      result.current.show();
    });
    expect(result.current.isVisible).toBe(false);
  });

  it("milestones fire independently — dismissing one does not block the others", () => {
    const { result: stars } = renderHook(() => useConnectPrompt("stars"));
    const { result: victory } = renderHook(() => useConnectPrompt("victory"));
    act(() => {
      stars.current.show();
      stars.current.dismiss();
    });
    act(() => {
      victory.current.show();
    });
    expect(victory.current.isVisible).toBe(true);
    expect(window.localStorage.getItem(storageKey("stars"))).toBe("1");
    expect(window.localStorage.getItem(storageKey("victory"))).toBe("1");
  });

  it("survives subsequent show() calls without re-showing once dismissed", () => {
    const { result } = renderHook(() => useConnectPrompt("stars"));
    act(() => {
      result.current.show();
    });
    act(() => {
      result.current.dismiss();
    });
    act(() => {
      result.current.show();
    });
    expect(result.current.isVisible).toBe(false);
  });

  it("tolerates a localStorage that throws on read", () => {
    const original = window.localStorage.getItem;
    Object.defineProperty(window.localStorage, "getItem", {
      configurable: true,
      value: () => {
        throw new Error("denied");
      },
    });
    try {
      const { result } = renderHook(() => useConnectPrompt("stars"));
      act(() => {
        result.current.show();
      });
      expect(result.current.isVisible).toBe(true);
    } finally {
      Object.defineProperty(window.localStorage, "getItem", {
        configurable: true,
        value: original,
      });
    }
  });

  it("tolerates a localStorage that throws on write", () => {
    const original = window.localStorage.setItem;
    Object.defineProperty(window.localStorage, "setItem", {
      configurable: true,
      value: () => {
        throw new Error("quota exceeded");
      },
    });
    try {
      const { result } = renderHook(() => useConnectPrompt("victory"));
      act(() => {
        result.current.show();
      });
      expect(result.current.isVisible).toBe(true);
    } finally {
      Object.defineProperty(window.localStorage, "setItem", {
        configurable: true,
        value: original,
      });
    }
  });
});
