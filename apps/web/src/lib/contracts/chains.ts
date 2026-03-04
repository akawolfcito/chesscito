const CELO_MAINNET_ID = 42220;
const CELO_SEPOLIA_ID = 11142220;

export function getScoreboardAddress(chainId: number | undefined): `0x${string}` | null {
  if (chainId === CELO_MAINNET_ID) {
    return normalizeAddress(process.env.NEXT_PUBLIC_SCOREBOARD_ADDRESS_CELO);
  }

  if (chainId === CELO_SEPOLIA_ID) {
    return normalizeAddress(process.env.NEXT_PUBLIC_SCOREBOARD_ADDRESS_CELO_SEPOLIA);
  }

  return null;
}

export function getMiniPayFeeCurrency(chainId: number | undefined): `0x${string}` | undefined {
  if (chainId === CELO_MAINNET_ID) {
    return normalizeAddress(process.env.NEXT_PUBLIC_MINIPAY_FEE_CURRENCY_CELO) ?? undefined;
  }

  if (chainId === CELO_SEPOLIA_ID) {
    return normalizeAddress(process.env.NEXT_PUBLIC_MINIPAY_FEE_CURRENCY_CELO_SEPOLIA) ?? undefined;
  }

  return undefined;
}

function normalizeAddress(value: string | undefined): `0x${string}` | null {
  if (!value || !value.startsWith("0x") || value.length !== 42) {
    return null;
  }

  return value as `0x${string}`;
}
