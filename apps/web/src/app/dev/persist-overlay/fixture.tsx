"use client";

import { PersistOverlay, type PersistState } from "@/components/arena/arena-end-state";

export function PersistOverlayFixture({ state }: { state: PersistState }) {
  return (
    <main
      data-testid="dev-persist-overlay-root"
      className="relative min-h-[100dvh] w-full bg-[#1a0f0a]"
    >
      <PersistOverlay
        state={state}
        onRetry={() => {}}
        onDismiss={() => {}}
      />
    </main>
  );
}
