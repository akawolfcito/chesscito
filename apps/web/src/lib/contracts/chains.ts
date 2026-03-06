const SUPPORTED_CHAIN_IDS = new Set([42220, 44787, 11142220]);

export function getScoreboardAddress(chainId: number | undefined): `0x${string}` | null {
  if (!chainId || chainId !== getConfiguredChainId()) {
    return null;
  }

  return normalizeAddress(process.env.NEXT_PUBLIC_SCOREBOARD_ADDRESS);
}

export function getBadgesAddress(chainId: number | undefined): `0x${string}` | null {
  if (!chainId || chainId !== getConfiguredChainId()) {
    return null;
  }

  return normalizeAddress(process.env.NEXT_PUBLIC_BADGES_ADDRESS);
}

export function getShopAddress(chainId: number | undefined): `0x${string}` | null {
  if (!chainId || chainId !== getConfiguredChainId()) {
    return null;
  }

  return normalizeAddress(process.env.NEXT_PUBLIC_SHOP_ADDRESS);
}

export function getUsdcAddress(chainId: number | undefined): `0x${string}` | null {
  if (!chainId || chainId !== getConfiguredChainId()) {
    return null;
  }

  return normalizeAddress(process.env.NEXT_PUBLIC_USDC_ADDRESS);
}

export function getMiniPayFeeCurrency(chainId: number | undefined): `0x${string}` | undefined {
  if (!chainId || chainId !== getConfiguredChainId()) {
    return undefined;
  }

  return normalizeAddress(process.env.NEXT_PUBLIC_MINIPAY_FEE_CURRENCY) ?? undefined;
}

export function getConfiguredChainId() {
  const parsed = Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "", 10);
  return SUPPORTED_CHAIN_IDS.has(parsed) ? parsed : null;
}

function normalizeAddress(value: string | undefined): `0x${string}` | null {
  if (!value || !value.startsWith("0x") || value.length !== 42) {
    return null;
  }

  return value as `0x${string}`;
}
