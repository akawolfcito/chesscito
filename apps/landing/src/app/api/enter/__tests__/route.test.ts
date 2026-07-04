import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/enter/route";
import { PLAY_URL, FULL_URL } from "@/lib/app-urls";
import { ONBOARDING_COOKIE } from "@/lib/onboarding/types";

function makeRequest(query: string): NextRequest {
  return new NextRequest(`https://chesscito.com/api/enter${query}`);
}

describe("GET /api/enter", () => {
  it("redirects to PLAY_URL for mode=learn", async () => {
    const res = await GET(makeRequest("?mode=learn"));
    expect(res.headers.get("location")).toBe(`${PLAY_URL}/`);
  });

  it("redirects to FULL_URL for mode=play", async () => {
    const res = await GET(makeRequest("?mode=play"));
    expect(res.headers.get("location")).toBe(`${FULL_URL}/`);
  });

  it("sets both onboarding cookies for a valid mode", async () => {
    const res = await GET(makeRequest("?mode=learn"));
    expect(res.cookies.get(ONBOARDING_COOKIE.onboarded)?.value).toBe("true");
    expect(res.cookies.get(ONBOARDING_COOKIE.preferredMode)?.value).toBe(
      "learn",
    );
  });

  it("redirects to /classic and sets no cookies for a missing mode", async () => {
    const res = await GET(makeRequest(""));
    expect(res.headers.get("location")).toBe("https://chesscito.com/classic");
    expect(res.cookies.get(ONBOARDING_COOKIE.onboarded)).toBeUndefined();
  });

  it("redirects to /classic for an invalid mode", async () => {
    const res = await GET(makeRequest("?mode=bogus"));
    expect(res.headers.get("location")).toBe("https://chesscito.com/classic");
    expect(res.cookies.get(ONBOARDING_COOKIE.preferredMode)).toBeUndefined();
  });
});
