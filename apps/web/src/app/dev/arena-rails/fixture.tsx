"use client";

import { ArenaPlayerRail } from "@/components/arena/arena-player-rail";

/** Fixture variants for the arena player rails.
 *
 *  Why this probe exists: no VR baseline reached a `PlayerAvatar` before
 *  2026-07-13, so a border-radius change to `.player-card-img` (c63b34fc)
 *  shipped with the whole suite green. The rails are the sole consumer of the
 *  redesign PlayerAvatar, so locking them locks that surface.
 *
 *  Building this probe is what exposed the rail's wallet dependency: it called
 *  `useIsProActive()` internally, so mounting it here threw
 *  WagmiProviderNotFoundError and the first baselines silently photographed a
 *  Next.js error overlay — green tests, garbage images. `pro` is a prop now,
 *  and the rail is presentational (the /dev layout mounts no wallet stack, on
 *  purpose). */
export type ArenaRailsVariant =
  | "rival-idle"
  | "rival-thinking"
  | "you-active"
  | "you-no-meta"
  | "rails-pro";

/** Mirrors the live arena: the rival meta line is "<difficulty> · <elo> ELO",
 *  the player's is the Identity Lite nickname. */
const RIVAL_AVATAR = "/art/rivals/pipo-avatar.png";

export function ArenaRailsFixture({ variant }: { variant: ArenaRailsVariant }) {
  return (
    <main
      data-testid="dev-arena-rails-root"
      className="flex min-h-[100dvh] flex-col justify-center arena-bg"
    >
      <div className="mx-auto w-full max-w-[var(--app-max-width)] px-2">
        {variant === "rival-idle" && (
          <ArenaPlayerRail
            side="rival"
            name="Pipo"
            meta="Easy · 487 ELO"
            avatarSrc={RIVAL_AVATAR}
          />
        )}

        {variant === "rival-thinking" && (
          <ArenaPlayerRail
            side="rival"
            name="Pipo"
            meta="Easy · 487 ELO"
            avatarSrc={RIVAL_AVATAR}
            isThinking
            isActive
          />
        )}

        {variant === "you-active" && (
          <ArenaPlayerRail side="you" name="You" meta="wolfcito" isActive />
        )}

        {/* Visitor with no nickname. The meta line is dropped but the rail must
         *  keep its height, or the board shifts vertically between a connected
         *  and a disconnected session. Rendered under the nicknamed rail so one
         *  image captures both heights. */}
        {variant === "you-no-meta" && (
          <div className="flex flex-col gap-1.5">
            <ArenaPlayerRail side="you" name="You" meta="wolfcito" isActive />
            <ArenaPlayerRail side="you" name="You" isActive />
          </div>
        )}

        {/* PRO draws an ornamental PNG frame behind BOTH avatars — never a CSS
         *  ring (spec §4 hard rule). Stacked with the board's own gap so the
         *  ornament is captured at the size it actually ships at. */}
        {variant === "rails-pro" && (
          <div className="flex flex-col gap-1.5">
            <ArenaPlayerRail
              side="rival"
              name="Pipo"
              meta="Easy · 487 ELO"
              avatarSrc={RIVAL_AVATAR}
              pro
            />
            <ArenaPlayerRail side="you" name="You" meta="wolfcito" isActive pro />
          </div>
        )}
      </div>
    </main>
  );
}
