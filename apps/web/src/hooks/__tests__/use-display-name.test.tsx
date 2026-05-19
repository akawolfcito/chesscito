import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDisplayName, displayNameStorageKey } from "@/hooks/use-display-name";

beforeEach(() => { window.localStorage.clear(); });

describe("useDisplayName", () => {
  const wallet = "0x0924abcdef1234567890abcdef1234567890eba4" as const;

  it("falls back to truncated wallet", () => {
    const { result } = renderHook(() => useDisplayName(wallet));
    expect(result.current.name).toBe("0x0924…eba4");
  });

  it("returns persisted custom name", () => {
    window.localStorage.setItem(displayNameStorageKey(wallet), "Akawolf");
    const { result } = renderHook(() => useDisplayName(wallet));
    expect(result.current.name).toBe("Akawolf");
  });

  it("persists name on setName", () => {
    const { result } = renderHook(() => useDisplayName(wallet));
    act(() => result.current.setName("Wolfcito"));
    expect(result.current.name).toBe("Wolfcito");
    expect(window.localStorage.getItem(displayNameStorageKey(wallet))).toBe("Wolfcito");
  });

  it("clears name when given empty string", () => {
    window.localStorage.setItem(displayNameStorageKey(wallet), "Akawolf");
    const { result } = renderHook(() => useDisplayName(wallet));
    act(() => result.current.setName(""));
    expect(result.current.name).toBe("0x0924…eba4");
  });

  it("returns Visitor when wallet is undefined", () => {
    const { result } = renderHook(() => useDisplayName(undefined));
    expect(result.current.name).toBe("Visitor");
  });
});
