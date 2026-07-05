"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

export type PlayHubData = {
  address: `0x${string}` | undefined;
  isConnected: boolean;
  mintedVictoryCount: number;
  isLoadingVictories: boolean;
  victoriesError: boolean;
};

/** Play-only data boundary. Victory NFTs are the sole trophy source; this hook
 * intentionally has no dependency on badges, stars, Daily Focus or Training. */
export function usePlayHubData(): PlayHubData {
  const { address, isConnected } = useAccount();
  const [mintedVictoryCount, setMintedVictoryCount] = useState(0);
  const [isLoadingVictories, setIsLoadingVictories] = useState(false);
  const [victoriesError, setVictoriesError] = useState(false);

  useEffect(() => {
    setMintedVictoryCount(0);
    setVictoriesError(false);

    if (!isConnected || !address) {
      setIsLoadingVictories(false);
      return;
    }

    const controller = new AbortController();
    setIsLoadingVictories(true);

    void fetch(`/api/my-victories?player=${encodeURIComponent(address)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("victories request failed");
        const rows: unknown = await response.json();
        if (!Array.isArray(rows)) throw new Error("invalid victories response");
        setMintedVictoryCount(rows.length);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setVictoriesError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingVictories(false);
      });

    return () => controller.abort();
  }, [address, isConnected]);

  return {
    address,
    isConnected,
    mintedVictoryCount,
    isLoadingVictories,
    victoriesError,
  };
}
