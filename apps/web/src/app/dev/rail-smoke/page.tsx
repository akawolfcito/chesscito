import { notFound } from "next/navigation";

import { RailSmokeClient } from "./rail-smoke-client";

// Internal dev surface for the stablecoin single-tx payment rail smoke
// (slice G prep). Never shipped to production — 404s there — and the
// button itself is treasury-gated (fail-closed) inside the client.
export const dynamic = "force-dynamic";

export default function RailSmokeDevPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <RailSmokeClient />;
}
