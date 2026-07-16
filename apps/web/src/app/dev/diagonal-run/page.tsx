"use client";

/**
 * /dev/diagonal-run — DEV-ONLY probe for the Diagonal Run one-level spike
 * (Gate D2). Level: a1 → g1, friendly knight on e5 (glide optimalMoves = 2).
 * Not wired into production Special Training — that is Gate D3.
 */

import { notFound } from "next/navigation";
import { DiagonalRunSpike } from "@/components/dev/diagonal-run-spike";

export const dynamic = "force-dynamic";

export default function DiagonalRunPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="min-h-screen bg-slate-950 py-4">
      <DiagonalRunSpike />
    </main>
  );
}
