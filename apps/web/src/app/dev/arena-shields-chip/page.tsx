"use client";

import { notFound } from "next/navigation";

import { ArenaShieldsChip } from "@/components/arena/arena-hud";

/**
 * VR fixture for the point-of-use shields callout that arena renders
 * under the HUD when the wallet has shields ready. The chip pulls its
 * count from `useShieldsCount()` (localStorage-backed), so the VR test
 * seeds `chesscito:shields:credited-cache` via `page.addInitScript`
 * BEFORE navigation. With nothing seeded the chip returns null, which
 * is itself a useful "off" state.
 *
 * Mounts the chip in isolation (no full ArenaHud, no wagmi) so the
 * baseline locks the chip's intrinsic pixels rather than the
 * surrounding HUD chrome — a small piece of self-contained surface.
 */
export const dynamic = "force-dynamic";

export default function ArenaShieldsChipDevPage() {
  if (process.env.NODE_ENV === "production") notFound();

  // Mirrors the wrapper arena renders around the chip
  // (`flex justify-end px-2`) so the framing matches the production HUD.
  return (
    <main
      data-testid="dev-arena-shields-chip-root"
      className="relative min-h-[100dvh] w-full bg-[#1a0f0a] p-4"
    >
      <div className="mx-auto w-full max-w-[var(--app-max-width)]">
        <div className="flex justify-end px-2">
          <ArenaShieldsChip />
        </div>
      </div>
    </main>
  );
}
