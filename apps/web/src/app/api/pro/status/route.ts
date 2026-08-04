import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { isProActive } from "@/lib/pro/is-active";
import { enforceOrigin, getRequestIp } from "@/lib/server/demo-signing";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createLogger } from "@/lib/server/logger";

const logger = createLogger({ route: "/api/pro/status" });

export const dynamic = "force-dynamic";

/** Read-only PRO status for a wallet. Returns whatever
 *  isProActive() returns: `{ active, expiresAt }`. Never mutates Redis,
 *  never seeds, never side-effects. UI hooks poll this endpoint to
 *  decide whether to render the PRO chip as "Get PRO" or "PRO active".
 *
 *  Mirrors the auth shape of /api/coach/credits (origin + rate-limit
 *  with a single 403 response on failure) so MiniPay's WebView, which
 *  may omit Origin/Referer on same-site fetches, behaves consistently
 *  across the two endpoints. */
export async function GET(req: Request) {
  try {
    enforceOrigin(req);
  } catch (err) {
    logger.warn("auth rejected", {
      errName: err instanceof Error ? err.name : "unknown",
      errMessage: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Read-only status endpoint on its own 60/min/IP bucket (D0.3) so a user
  // navigating scaffold ↔ legacy does not 403 the PRO chip into a permanent
  // inactive state — and no longer shares that budget with thirteen other
  // routes.
  //
  // FAIL-OPEN (D0.1): this route only READS the PRO key. Serving it during an
  // Upstash outage grants nobody anything; every path that GRANTS pro
  // (/api/verify-pro, the payment routes) stays fail-closed.
  const limit = await checkRateLimit({
    identifier: getRequestIp(req),
    route: "pro-status",
    policy: "fail-open",
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }

  try {
    const status = await isProActive(wallet);
    return NextResponse.json(status);
  } catch (err) {
    logger.error("isProActive threw", {
      wallet,
      errName: err instanceof Error ? err.name : "unknown",
      errMessage: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
