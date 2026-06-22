import { redirect, notFound } from "next/navigation";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";

// Catch-all for any path within [locale] that has no explicit page.
// Using a page route (not not-found.tsx) guarantees redirect() works —
// not-found.tsx runs inside Next.js's 404 error boundary where
// NEXT_REDIRECT is not reliably propagated.
export default function CatchAllPage() {
  if (CHESSCITO_LITE_MODE) {
    redirect("/hub");
  }
  notFound();
}
