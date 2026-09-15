import { preconnect } from "react-dom";

import { LEARN_URL, PLAY_URL } from "@/lib/app-urls";

/**
 * The landing's only product exits. Keep these derived from the same origins
 * as `/api/enter`, so preview deployments warm their preview targets too.
 *
 * `preconnect` already includes DNS resolution, so a separate dns-prefetch
 * would be redundant for these two deliberately warmed origins.
 */
export const PRODUCT_CONNECTION_ORIGINS = [LEARN_URL, PLAY_URL] as const;

export function preconnectProductOrigins(
  connect: typeof preconnect = preconnect,
): void {
  for (const origin of PRODUCT_CONNECTION_ORIGINS) {
    connect(origin, { crossOrigin: "anonymous" });
  }
}
