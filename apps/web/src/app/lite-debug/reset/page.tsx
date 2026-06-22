import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiteResetClient } from "./reset-client";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Hidden QA-only route. `ENABLE_LITE_QA_RESET` is intentionally server-only:
 * normal production requests receive a 404 and never mount the reset client.
 */
export default function LiteDebugResetPage() {
  if (!CHESSCITO_LITE_MODE || process.env.ENABLE_LITE_QA_RESET !== "true") {
    notFound();
  }
  return <LiteResetClient />;
}
