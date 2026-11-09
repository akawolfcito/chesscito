"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { postAuthorizedCoachAnalyze } from "./coach-request-access";

export function useCoachRequestAccess() {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const key = `${address?.toLowerCase()}:${chainId}`;
  const identity = useRef({ key });
  if (identity.current.key !== key) identity.current = { key };
  const current = useRef({ address, chainId, signMessageAsync });
  current.current = { address, chainId, signMessageAsync };
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return useCallback<typeof fetch>(async (input, init) => {
    const signer = current.current;
    const signingIdentity = identity.current;
    return postAuthorizedCoachAnalyze(input, init, {
      origin: window.location.origin, wallet: signer.address, signMessage: signer.signMessageAsync,
      isCurrent: () => mounted.current && identity.current === signingIdentity && current.current.chainId === 42220,
    });
  }, []);
}

/** Saved analysis status is public; polling never prompts a signer. */
export function useCoachJobAccess(wallet?: string) {
  return useCallback((_jobId: string) => wallet ? {} : null, [wallet]);
}
