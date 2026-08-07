/**
 * Every contract getter in `chains.ts` gates on
 * `chainId === getConfiguredChainId()`. For a DISCONNECTED visitor wagmi
 * reports its first configured chain, so the configured id has to equal that
 * default or nothing resolves: `getShopAddress()` returns null, the catalog is
 * never read, and every pill renders "Coming soon".
 *
 * This is pure so the dev banner stays a rendering concern. It knows nothing
 * about where the id came from — a shell export, an env file, or a typo all
 * surface identically, which is the point: the symptom is what we can see.
 */
export type ChainConfigDiagnosis =
  | { status: "ok" }
  | { status: "unset"; defaultChainId: number }
  | {
      status: "default-mismatch";
      configuredChainId: number;
      defaultChainId: number;
    };

export function diagnoseChainConfiguration({
  configuredChainId,
  defaultChainId,
}: {
  configuredChainId: number | null;
  defaultChainId: number;
}): ChainConfigDiagnosis {
  if (configuredChainId == null) {
    return { status: "unset", defaultChainId };
  }

  if (configuredChainId !== defaultChainId) {
    return { status: "default-mismatch", configuredChainId, defaultChainId };
  }

  return { status: "ok" };
}
