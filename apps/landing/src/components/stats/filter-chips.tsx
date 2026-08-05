import Link from "next/link";

import type { StatsCopy } from "@/lib/stats/copy";
import type { StatsFilters } from "@/lib/stats/filters";
import type { StatsLocale } from "@/lib/stats/locale";

/**
 * The surface / container chips.
 *
 * Plain links, not a client component: `/stats` is a public read-only page and
 * a router push would buy nothing but a JavaScript dependency.
 *
 * ⚠️ Each chip preserves the OTHER filter and the locale. Dropping either is
 * the classic bug here — you pick "Play" and silently lose "MiniPay", or the
 * page flips back to English mid-navigation.
 */

/** `all` is omitted so the canonical URL stays clean; `locale` rides along only
 *  when it was explicitly chosen, because it is presentation and must not turn
 *  every shared link into a language lock. */
export function buildStatsHref(
  filters: StatsFilters,
  localeOverride: StatsLocale | null,
): string {
  const params = new URLSearchParams();
  if (filters.surface !== "all") params.set("surface", filters.surface);
  if (filters.container !== "all") params.set("container", filters.container);
  if (localeOverride) params.set("locale", localeOverride);
  const qs = params.toString();
  return qs ? `/stats?${qs}` : "/stats";
}

function Chip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className="inline-flex min-h-[34px] items-center rounded-full border px-3 text-[0.7rem] font-extrabold uppercase tracking-[0.1em] transition-opacity hover:opacity-80"
      style={{
        background: active ? "var(--landing-accent-bg-strong)" : "var(--landing-card-bg)",
        borderColor: active
          ? "var(--landing-accent-border-strong)"
          : "var(--landing-card-border)",
        color: active ? "var(--landing-text)" : "var(--paper-text-muted)",
      }}
    >
      {label}
    </Link>
  );
}

export function FilterChips({
  filters,
  localeOverride,
  copy,
}: {
  filters: StatsFilters;
  localeOverride: StatsLocale | null;
  copy: StatsCopy;
}) {
  const surfaces: Array<[StatsFilters["surface"], string]> = [
    ["all", copy.all],
    ["learn", copy.learn],
    ["play", copy.play],
  ];
  const containers: Array<[StatsFilters["container"], string]> = [
    ["all", copy.all],
    ["minipay", copy.minipay],
    ["browser", copy.browser],
  ];

  return (
    <div className="mb-8 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em]"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          {copy.filterSurface}
        </span>
        {surfaces.map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            active={filters.surface === value}
            href={buildStatsHref({ ...filters, surface: value }, localeOverride)}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em]"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          {copy.filterContainer}
        </span>
        {containers.map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            active={filters.container === value}
            href={buildStatsHref({ ...filters, container: value }, localeOverride)}
          />
        ))}
      </div>
    </div>
  );
}
