/**
 * Presentational tile for a single public stat. `value === null` renders
 * the em-dash placeholder so a failed query never blanks the page.
 */

type StatCardProps = {
  label: string;
  value: number | null;
  sublabel?: string;
  /**
   * `hero` = vital-signs tile for the Executive Snapshot (largest
   * number, more padding, cream-amber fill). `primary` = default
   * headline tile with fill. `secondary` = supporting smaller tile
   * with fill. `bare` = typographic-only mode with NO tile fill,
   * used for the Activity windows so they read as a tabular grid
   * on the page background instead of yet another box family.
   */
  variant?: "hero" | "primary" | "secondary" | "bare";
};

const VALUE_CLASS: Record<NonNullable<StatCardProps["variant"]>, string> = {
  hero: "text-3xl md:text-4xl font-bold tabular-nums",
  primary: "text-2xl font-bold",
  secondary: "text-lg font-semibold",
  bare: "text-lg font-semibold tabular-nums",
};

const CONTAINER_CLASS: Record<NonNullable<StatCardProps["variant"]>, string> = {
  hero: "paper-tray px-5 py-4",
  primary: "paper-tray px-4 py-3",
  secondary: "paper-tray px-4 py-3",
  bare: "py-2",
};

export function StatCard({
  label,
  value,
  sublabel,
  variant = "primary",
}: StatCardProps) {
  const displayValue =
    value === null
      ? "—"
      : new Intl.NumberFormat("en-US").format(value);

  return (
    <div
      className={`flex flex-col gap-1 ${CONTAINER_CLASS[variant]}`}
      style={{ color: "var(--paper-text)" }}
    >
      <span
        className="text-[0.625rem] font-semibold uppercase tracking-wide"
        style={{ color: "var(--paper-text-subtle)" }}
      >
        {label}
      </span>
      <span className={VALUE_CLASS[variant]}>{displayValue}</span>
      {sublabel ? (
        <span
          className="text-[0.6875rem] leading-tight"
          style={{ color: "var(--paper-text-muted)" }}
        >
          {sublabel}
        </span>
      ) : null}
    </div>
  );
}
