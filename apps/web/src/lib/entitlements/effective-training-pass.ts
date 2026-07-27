export type EffectiveTrainingPass = {
  active: boolean;
  source: "pro" | "season_pass" | null;
  seasonPassExpiresAt: string | null;
  proExpiresAt: number | null;
  /** Season the progress is imputed to. Resolved HERE, once, so the status
   *  route cannot hand out one season on its Redis fast path and a different
   *  one on its Supabase path for the same wallet.
   *  Spec: docs/specs/2026-07-27-focus-days-ledger.md (APPROVED). */
  seasonId: string | null;
};

type SeasonPassEntitlement = {
  active: boolean;
  expiresAt: string | null;
  /** The season frozen into the purchased row. `null` when the caller has not
   *  read the row (the Redis fast path knows the expiry, not the season). */
  seasonId?: string | null;
};

type ProEntitlement = {
  active: boolean;
  expiresAt: number | null;
};

export function resolveEffectiveTrainingPass({
  seasonPass,
  pro,
  configuredSeasonId = null,
  now = Date.now(),
}: {
  seasonPass: SeasonPassEntitlement;
  pro: ProEntitlement;
  /** Current season from config. Used ONLY for PRO, which has no purchased
   *  row. Never a fallback for a buyer whose row was not read. */
  configuredSeasonId?: string | null;
  now?: number;
}): EffectiveTrainingPass {
  const seasonPassExpiresAt = seasonPass.expiresAt;
  const seasonPassExpiry = seasonPassExpiresAt
    ? new Date(seasonPassExpiresAt).getTime()
    : Number.NaN;
  const seasonPassActive =
    seasonPass.active && Number.isFinite(seasonPassExpiry) && seasonPassExpiry > now;

  const proExpiresAt = pro.expiresAt;
  const proActive =
    pro.active && proExpiresAt !== null && Number.isFinite(proExpiresAt) && proExpiresAt > now;

  const source = proActive ? "pro" : seasonPassActive ? "season_pass" : null;

  // A buyer's season comes from their row and nowhere else. Substituting the
  // configured literal when the row was not read is how progress ends up under
  // the wrong temporada after a rollover.
  const seasonId =
    source === "pro"
      ? configuredSeasonId
      : source === "season_pass"
        ? (seasonPass.seasonId ?? null)
        : null;

  return {
    active: proActive || seasonPassActive,
    source,
    seasonPassExpiresAt,
    proExpiresAt,
    seasonId,
  };
}
