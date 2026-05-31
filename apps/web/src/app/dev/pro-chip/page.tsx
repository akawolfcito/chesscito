import { notFound } from "next/navigation";

import { HubProBadge } from "@/components/hub/hub-pro-badge";

/**
 * VR fixture for the PRO chip in its active variant — the days-
 * remaining state that the Hub HUD renders for subscribed wallets.
 * Mounts the `<HubProBadge>` slice in isolation (no wallet, no wagmi
 * — the badge takes its truth values as props, so the test owns the
 * variant). Mirrors `/dev/arena-shields-chip` (commit 74adf775).
 */
export const dynamic = "force-dynamic";

export default function ProChipDevPage({
  searchParams,
}: {
  searchParams: { variant?: string };
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const variant = searchParams.variant === "inactive" ? "inactive" : "active";
  const active = variant === "active";

  return (
    <main
      data-testid="dev-pro-chip-root"
      className="relative min-h-[100dvh] w-full bg-[#1a0f0a] p-4"
    >
      <div className="mx-auto w-full max-w-[var(--app-max-width)]">
        <div className="flex justify-end px-2 pt-2">
          <HubProBadge
            active={active}
            daysRemaining={active ? 7 : undefined}
            daysLabel={active ? "7d" : undefined}
            sublineInactive={
              active ? undefined : "Unlock the full experience"
            }
            ariaLabel={active ? "PRO: 7 days left" : "Unlock PRO"}
          />
        </div>
      </div>
    </main>
  );
}
