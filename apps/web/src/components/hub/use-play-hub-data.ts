"use client";

import { useAccount } from "wagmi";

export type PlayHubData = {
  address: `0x${string}` | undefined;
  isConnected: boolean;
};

/** The Play hub only needs wallet state. Victory history belongs to the
 * trophies screen; loading it here costs an API request and database read
 * on every hub mount without displaying any of the returned rows. */
export function usePlayHubData(): PlayHubData {
  const { address, isConnected } = useAccount();
  return { address, isConnected };
}
