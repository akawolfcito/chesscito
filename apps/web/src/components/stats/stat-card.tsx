/**
 * Presentational tile for a single public stat. `value === null` renders
 * the em-dash placeholder so a failed query never blanks the page.
 */

type StatCardProps = {
  label: string;
  value: number | null;
  sublabel?: string;
  /** Renders the value as smaller, secondary metric (less hero) */
  variant?: "primary" | "secondary";
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

  const valueClass =
    variant === "primary"
      ? "text-2xl font-bold"
      : "text-lg font-semibold";

  return (
    <div
      className="paper-tray flex flex-col gap-1 px-4 py-3"
      style={{ color: "var(--paper-text)" }}
    >
      <span
        className="text-[0.625rem] font-semibold uppercase tracking-wide"
        style={{ color: "var(--paper-text-subtle)" }}
      >
        {label}
      </span>
      <span className={valueClass}>{displayValue}</span>
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
