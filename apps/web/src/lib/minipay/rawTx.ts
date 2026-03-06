import { encodeFunctionData, toHex } from "viem";

import type { Eip1193Provider } from "@/lib/minipay/provider";

type ProbeParams = {
  from: `0x${string}`;
  to: `0x${string}`;
  data: `0x${string}`;
};

type RawTxParams = {
  from: `0x${string}`;
  to: `0x${string}`;
  data: `0x${string}`;
  gas?: bigint | number | `0x${string}`;
  gasPrice?: bigint | number | `0x${string}`;
  value?: bigint | number | `0x${string}`;
  feeCurrency?: `0x${string}`;
};

type SendRawTxOptions = {
  skipFeeCurrencyRetry?: boolean;
  logLabel?: string;
};

function normalizeHexValue(value: bigint | number | `0x${string}`) {
  if (typeof value === "string") {
    return value;
  }

  return toHex(value);
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error as Error & { cause?: unknown }).cause ? { cause: (error as Error & { cause?: unknown }).cause } : {},
    };
  }

  return error;
}

export function encodeCallData({
  abi,
  functionName,
  args,
}: {
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
}): `0x${string}` {
  return encodeFunctionData({
    abi,
    functionName,
    args,
  });
}

export async function probeEstimateAndCall(provider: Eip1193Provider, { from, to, data }: ProbeParams) {
  const tx = { from, to, data };
  let estimateGas: string | null = null;
  let estimateGasError: unknown = null;
  let callResult: string | null = null;
  let callError: unknown = null;

  try {
    estimateGas = (await provider.request({
      method: "eth_estimateGas",
      params: [tx],
    })) as string;
  } catch (error) {
    estimateGasError = serializeError(error);
  }

  try {
    callResult = (await provider.request({
      method: "eth_call",
      params: [tx, "latest"],
    })) as string;
  } catch (error) {
    callError = serializeError(error);
  }

  return {
    estimateGasOk: Boolean(estimateGas),
    estimateGas,
    estimateGasError,
    callOk: Boolean(callResult),
    callResult,
    callError,
  };
}

export async function sendRawTxNoEstimate(
  provider: Eip1193Provider,
  { from, to, data, gas, gasPrice, value, feeCurrency }: RawTxParams,
  options: SendRawTxOptions = {}
) {
  const { skipFeeCurrencyRetry = false, logLabel = "tx" } = options;
  const tx = {
    from,
    to,
    data,
    ...(gas != null ? { gas: normalizeHexValue(gas) } : {}),
    ...(gasPrice != null ? { gasPrice: normalizeHexValue(gasPrice) } : {}),
    ...(value != null ? { value: normalizeHexValue(value) } : {}),
    ...(feeCurrency ? { feeCurrency } : {}),
  };

  console.info("[MiniPayTx] eth_sendTransaction request", {
    label: logLabel,
    tx,
  });

  try {
    const txHash = (await provider.request({
      method: "eth_sendTransaction",
      params: [tx],
    })) as string;

    console.info("[MiniPayTx] eth_sendTransaction result", {
      label: logLabel,
      txHash,
    });
    return { txHash, error: null, payload: tx, retriedWithoutFeeCurrency: false };
  } catch (error) {
    if (feeCurrency && !skipFeeCurrencyRetry) {
      const retryTx = {
        from,
        to,
        data,
        ...(gas != null ? { gas: normalizeHexValue(gas) } : {}),
        ...(gasPrice != null ? { gasPrice: normalizeHexValue(gasPrice) } : {}),
        ...(value != null ? { value: normalizeHexValue(value) } : {}),
      };
      console.info("[MiniPayTx] eth_sendTransaction retry request", {
        label: logLabel,
        tx: retryTx,
      });
      try {
        const retryHash = (await provider.request({
          method: "eth_sendTransaction",
          params: [retryTx],
        })) as string;
        console.info("[MiniPayTx] eth_sendTransaction retry result", {
          label: logLabel,
          txHash: retryHash,
        });
        return {
          txHash: retryHash,
          error: null,
          payload: retryTx,
          retriedWithoutFeeCurrency: true,
        };
      } catch (retryError) {
        return {
          txHash: null,
          error: {
            initial: serializeError(error),
            retryWithoutFeeCurrency: serializeError(retryError),
          },
          payload: {
            initial: tx,
            retryWithoutFeeCurrency: retryTx,
          },
          retriedWithoutFeeCurrency: true,
        };
      }
    }

    return { txHash: null, error: serializeError(error), payload: tx, retriedWithoutFeeCurrency: false };
  }
}

export async function requestLegacyGasPrice(
  provider: Eip1193Provider,
  feeCurrency?: `0x${string}`
) {
  const attempts = feeCurrency
    ? [
        {
          method: "eth_gasPrice",
          params: [feeCurrency] as unknown[],
          mode: "feeCurrencyParam" as const,
        },
        {
          method: "eth_gasPrice",
          params: [] as unknown[],
          mode: "default" as const,
        },
      ]
    : [
        {
          method: "eth_gasPrice",
          params: [] as unknown[],
          mode: "default" as const,
        },
      ];

  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      const gasPrice = (await provider.request({
        method: attempt.method,
        params: attempt.params,
      })) as string;
      return {
        ok: true,
        gasPrice,
        mode: attempt.mode,
        error: null,
      };
    } catch (error) {
      lastError = serializeError(error);
    }
  }

  return {
    ok: false,
    gasPrice: null,
    mode: null,
    error: lastError,
  };
}
