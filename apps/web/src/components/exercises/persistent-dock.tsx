"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DOCK_LABELS } from "@/lib/content/editorial";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { track } from "@/lib/telemetry";

export type DockTab = "badge" | "shop" | "trophies" | "leaderboard" | "arena" | null;

type PersistentDockProps = {
  badgeControl: ReactNode;
  shopControl: ReactNode;
  trophiesControl: ReactNode;
  leaderboardControl: ReactNode;
  /** Optional arena sheet trigger. When provided, the center button
   *  opens the arena entry sheet instead of navigating. When omitted
   *  (e.g., from /arena itself) the center falls back to a Link. */
  arenaControl?: ReactNode;
  /** Which destination tab is currently active. Drives the lift +
   *  label treatment on that item so the user always knows where
   *  they are. Null = no destination active. */
  activeDockTab: DockTab;
};

type ItemProps = {
  id: "badge" | "shop" | "trophies" | "leaderboard";
  label: string;
  control: ReactNode;
  activeDockTab: DockTab;
};

function DockItem({ id, label, control, activeDockTab }: ItemProps) {
  const isActive = activeDockTab === id;
  return (
    <div
      className={`chesscito-dock-item${isActive ? " is-active" : ""}`}
      data-dock-id={id}
      onClickCapture={() => track("dock_tap", { item: id })}
    >
      {control}
      <span className="chesscito-dock-item-label game-label text-nano font-bold uppercase tracking-[0.12em]">
        {label}
      </span>
    </div>
  );
}

function PiecesDockIcon() {
  const base = "/art/redesign/pieces/w-rook";
  return (
    <picture className="inline-block h-9 w-9">
      <source srcSet={`${base}.avif`} type="image/avif" />
      <source srcSet={`${base}.webp`} type="image/webp" />
      <img
        src={`${base}.png`}
        alt=""
        aria-hidden="true"
        className="block h-full w-full object-contain"
      />
    </picture>
  );
}

export function PersistentDock({
  badgeControl,
  shopControl,
  trophiesControl,
  leaderboardControl,
  arenaControl,
  activeDockTab,
}: PersistentDockProps) {
  const pathname = usePathname();
  const isArenaRoute = pathname?.startsWith("/arena") ?? false;
  const isPracticeRoute = pathname?.startsWith("/exercises") ?? false;
  const centerTarget = isArenaRoute
    ? {
      href: "/exercises",
      label: DOCK_LABELS.pieces,
      icon: <PiecesDockIcon />,
      trackItem: "pieces",
    }
    : {
      href: "/arena?fresh=1",
      label: DOCK_LABELS.arena,
      icon: <CandyBanner name="btn-battle" className="h-9 w-9" />,
      trackItem: "arena",
    };
  const isCenterActive = activeDockTab === "arena";

  return (
    <nav className="chesscito-dock" aria-label="Game navigation">
      <DockItem id="badge" label={DOCK_LABELS.badge} control={badgeControl} activeDockTab={activeDockTab} />
      <DockItem id="shop" label={DOCK_LABELS.shop} control={shopControl} activeDockTab={activeDockTab} />

      {/* Center — contextual mode switch between Practice Pieces and Arena.
          Label is always visible (not gated on is-active) because the
          center button is the primary CTA — its meaning shouldn't
          depend on the icon alone, which players reported as
          ambiguous. */}
      {arenaControl && isPracticeRoute ? (
        <div
          className={`chesscito-dock-center${isCenterActive ? " is-active" : ""}`}
          onClickCapture={() => track("dock_tap", { item: "arena" })}
        >
          {arenaControl}
          <span className="game-label text-nano font-bold uppercase tracking-[0.12em]">
            {DOCK_LABELS.arena}
          </span>
        </div>
      ) : (
        <Link
          href={centerTarget.href}
          className={`chesscito-dock-center${isCenterActive ? " is-active" : ""}`}
          onClick={() => track("dock_tap", { item: centerTarget.trackItem })}
        >
          {centerTarget.icon}
          <span className="game-label text-nano font-bold uppercase tracking-[0.12em]">
            {centerTarget.label}
          </span>
        </Link>
      )}

      <DockItem id="trophies" label={DOCK_LABELS.trophies} control={trophiesControl} activeDockTab={activeDockTab} />
      <DockItem id="leaderboard" label={DOCK_LABELS.leaderboard} control={leaderboardControl} activeDockTab={activeDockTab} />
    </nav>
  );
}
