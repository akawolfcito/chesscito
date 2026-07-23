/**
 * /stats surface + container filters (querystring, server-side re-aggregation).
 *
 * Allow-listed with an `all` fallback — an unknown value never leaks into a
 * query; it collapses to `all`. The filters are applied CONSISTENTLY across
 * every /stats block (app opens, activation, top countries, retention).
 */

export type SurfaceFilter = "all" | "learn" | "play";
export type ContainerFilter = "all" | "minipay" | "browser";
export type StatsFilters = { surface: SurfaceFilter; container: ContainerFilter };

export const DEFAULT_STATS_FILTERS: StatsFilters = {
  surface: "all",
  container: "all",
};

const SURFACE_VALUES = new Set<SurfaceFilter>(["all", "learn", "play"]);
const CONTAINER_VALUES = new Set<ContainerFilter>([
  "all",
  "minipay",
  "browser",
]);

function firstStr(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export function parseStatsFilters(searchParams: {
  surface?: string | string[];
  container?: string | string[];
}): StatsFilters {
  const s = firstStr(searchParams.surface) as SurfaceFilter;
  const c = firstStr(searchParams.container) as ContainerFilter;
  return {
    surface: SURFACE_VALUES.has(s) ? s : "all",
    container: CONTAINER_VALUES.has(c) ? c : "all",
  };
}

/** Build a `?surface=&container=` querystring, omitting `all` (the default) so
 *  the canonical URL stays clean. */
export function statsFiltersToQuery(filters: StatsFilters): string {
  const parts: string[] = [];
  if (filters.surface !== "all") parts.push(`surface=${filters.surface}`);
  if (filters.container !== "all") parts.push(`container=${filters.container}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
