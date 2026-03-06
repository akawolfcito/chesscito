type Eip1193Provider = {
  isMiniPay?: boolean;
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
};

function getWindowProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  const provider = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
  return provider ?? null;
}

export function getMiniPayProvider(): Eip1193Provider | null {
  const provider = getWindowProvider();
  if (!provider?.isMiniPay) {
    return null;
  }

  return provider;
}

export async function requestChainId(provider: Eip1193Provider) {
  const chainIdHex = (await provider.request({ method: "eth_chainId" })) as string;
  const chainId = Number.parseInt(chainIdHex, 16);

  return {
    chainIdHex,
    chainId: Number.isNaN(chainId) ? null : chainId,
  };
}

export async function requestAccount(provider: Eip1193Provider) {
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  return accounts[0] ?? null;
}

export function safeJson(value: unknown) {
  try {
    return JSON.stringify(
      value,
      (_, current) => {
        if (typeof current === "bigint") {
          return current.toString();
        }

        if (current instanceof Error) {
          return {
            name: current.name,
            message: current.message,
            stack: current.stack,
          };
        }

        return current;
      },
      2
    );
  } catch {
    return String(value);
  }
}

export type { Eip1193Provider };
