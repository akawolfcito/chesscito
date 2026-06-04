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
   * number, more padding). `primary` = default headline tile.
   * `secondary` = supporting Activity-windows-style smaller tile.
   */
  variant?: "hero" | "primary" | "secondary";
};

const VALUE_CLASS: Record<NonNullable<StatCardProps["variant"]>, string> = {
  hero: "text-3xl md:text-4xl font-bold tabular-nums",
  primary: "text-2xl font-bold",
  secondary: "text-lg font-semibold",
};

const CONTAINER_PADDING: Record<NonNullable<StatCardProps["variant"]>, string> = {
  hero: "px-5 py-4",
  primary: "px-4 py-3",
  secondary: "px-4 py-3",
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
      className={`paper-tray flex flex-col gap-1 ${CONTAINER_PADDING[variant]}`}
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
