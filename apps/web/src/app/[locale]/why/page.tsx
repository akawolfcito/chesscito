import { redirect } from "next/navigation";

/**
 * `/why` was the original mobile-only landing. The new responsive
 * landing now lives at `/`, so any link or bookmark pointing at
 * `/why` is permanently redirected to the canonical home. Server-
 * side redirect keeps SEO clean (308 to root) and skips rendering
 * the now-deprecated mobile layout.
 */
export default function WhyRedirectPage() {
  redirect("/");
}
