export type EffectiveTrainingPass = {
  active: boolean;
  source: "pro" | "season_pass" | null;
  seasonPassExpiresAt: string | null;
  proExpiresAt: number | null;
};

type SeasonPassEntitlement = {
  active: boolean;
  expiresAt: string | null;
};

type ProEntitlement = {
  active: boolean;
  expiresAt: number | null;
};

export function resolveEffectiveTrainingPass({
  seasonPass,
  pro,
  now = Date.now(),
}: {
  seasonPass: SeasonPassEntitlement;
  pro: ProEntitlement;
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

  return {
    active: proActive || seasonPassActive,
    source: proActive ? "pro" : seasonPassActive ? "season_pass" : null,
    seasonPassExpiresAt,
    proExpiresAt,
  };
}
