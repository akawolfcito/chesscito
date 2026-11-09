import { notFound } from "next/navigation";
import { isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

import { DevCatalogBrowser } from "./catalog-browser";

/**
 * The `/dev` index — every dev surface, clickable, with a live preview.
 *
 * Before this existed, reaching a screen meant knowing a `?variant=` name that
 * was declared inside that page's own `VARIANTS` Set and listed nowhere. The
 * fallback is silent (an unknown variant renders the DEFAULT one), so guessing
 * did not fail loudly — it showed the wrong screen.
 *
 * It also answers the question a style pass actually needs: these fixtures
 * mount the PRODUCTION component, so an edit propagates to every consumer —
 * and the catalog names those consumers up front rather than leaving them to
 * be found in a flow nobody walked. See `lib/dev/dev-catalog.ts`.
 */
export const dynamic = "force-dynamic";

export default function DevIndexPage() {
  if (!isDevSurfaceEnabled()) notFound();

  return <DevCatalogBrowser />;
}
