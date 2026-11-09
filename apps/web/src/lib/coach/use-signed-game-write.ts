"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import { postSignedGameWrite, type GameWriteArgs } from "./signed-game-write";

export function useSignedGameWrite() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const identityKey = `${address?.toLowerCase()}:${chainId}`;
  const identity = useRef({ key: identityKey });
  if (identity.current.key !== identityKey) identity.current = { key: identityKey };
  const current = useRef({ address, chainId, signMessageAsync });
  current.current = { address, chainId, signMessageAsync };
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  return useCallback(async (args: GameWriteArgs) => {
    const signer = current.current;
    const signingIdentity = identity.current;
    const isCurrent = () => mounted.current && identity.current === signingIdentity &&
      current.current.chainId === 42220 && current.current.address?.toLowerCase() === args.wallet.toLowerCase();
    return postSignedGameWrite(args, {
      origin: window.location.origin, signMessage: signer.signMessageAsync, isCurrent,
    });
  }, []);
}
