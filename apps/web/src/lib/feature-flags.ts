/** Hub V2 default-on rollout flag (design-lock §7.1).
 *
 *  Flip to `true` in Phase 8 once the four promote criteria pass for 7
 *  consecutive days (§7.4). The `?hub=v1` escape hatch keeps the V1 path
 *  reachable post-flip until Phase 9 cleanup.
 *
 *  Default value is intentionally a literal so dead-code elimination can
 *  drop the unreached branch from production bundles when flipped. */
export const HUB_V2_DEFAULT = false;

/** Next.js 14 App Router server-component `searchParams` shape. Each
 *  query key may be a single value, an array (when the URL repeats the
 *  key), or undefined. Spec §7.1. */
export type SearchParamsLike = {
  [key: string]: string | string[] | undefined;
};

/** Resolve which Hub variant (V1 or V2) renders for a given request.
 *
 *  Explicit `?hub=v2` or `?hub=v1` always wins (v2 = early access
 *  during ramp; v1 = escape hatch post-flip). When unset, `defaultOn`
 *  decides — defaults to `HUB_V2_DEFAULT` so production calls match the
 *  rollout phase, while tests can inject the opposite default to cover
 *  both orientations of the activation matrix.
 *
 *  Server-only by contract: callers in `app/hub/page.tsx` resolve at
 *  render time, eliminating client flicker (design-lock §7.3). */
export function resolveHubVariant(
  searchParams: SearchParamsLike,
  defaultOn: boolean = HUB_V2_DEFAULT,
): "v1" | "v2" {
  const raw = searchParams.hub;
  const explicit = Array.isArray(raw) ? raw[0] : raw;
  if (explicit === "v2") return "v2";
  if (explicit === "v1") return "v1";
  return defaultOn ? "v2" : "v1";
}
