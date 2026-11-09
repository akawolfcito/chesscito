"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { clearCoachJobAccess } from "./coach-request-access";
import {
  buildHistoryReadMessage, HISTORY_READ_ISSUED_HEADER,
  HISTORY_READ_SIGNATURE_HEADER, HISTORY_READ_TTL_MS,
} from "./history-read-message";

type Grant = { wallet: string; origin: string; issuedAt: number; headers: Record<string, string> };
// Tab memory only. Never persist a signature in storage, URLs, or telemetry.
let grant: Grant | null = null;
let sessionGeneration = 0;
const listeners = new Set<() => void>();
function publish(value: Grant | null) {
  grant = value;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Mounted for the whole wallet session, including while history is closed. */
export function useHistoryReadSessionReset() {
  const { address, chainId } = useAccount();
  useEffect(() => () => {
    sessionGeneration += 1;
    clearCoachJobAccess();
    publish(null);
  }, [address, chainId]);
}

export function useHistoryReadAccess(walletAddress?: string) {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const current = useSyncExternalStore(subscribe, () => grant, () => null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const wallet = walletAddress?.toLowerCase();
  const connected = address?.toLowerCase();
  const identity = `${connected}:${chainId}`;
  const identityRef = useRef({ key: identity });
  if (identityRef.current.key !== identity) identityRef.current = { key: identity };
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const canAuthorize = !!wallet && wallet === connected && chainId === 42220;
  const authorized = canAuthorize && current?.wallet === wallet && current.origin === origin &&
    Date.now() < current.issuedAt + HISTORY_READ_TTL_MS;

  useEffect(() => {
    if (grant && (grant.wallet !== connected || chainId !== 42220)) publish(null);
  }, [connected, chainId]);
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => {
      if (grant === current) publish(null);
    }, Math.max(0, current.issuedAt + HISTORY_READ_TTL_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [current]);

  const authorize = useCallback(async () => {
    if (!canAuthorize || !wallet || pending) return;
    const signingIdentity = identityRef.current;
    const signingGeneration = sessionGeneration;
    setPending(true);
    setError(false);
    try {
      const issuedAt = Date.now();
      const signature = await signMessageAsync({
        account: address,
        message: buildHistoryReadMessage(origin, wallet, issuedAt),
      });
      if (!mounted.current || sessionGeneration !== signingGeneration ||
          identityRef.current !== signingIdentity || Date.now() >= issuedAt + HISTORY_READ_TTL_MS) return;
      publish({ wallet, origin, issuedAt, headers: {
        [HISTORY_READ_ISSUED_HEADER]: String(issuedAt),
        [HISTORY_READ_SIGNATURE_HEADER]: signature,
      } });
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }, [canAuthorize, wallet, pending, signMessageAsync, address, origin]);

  const invalidate = useCallback(() => { if (grant === current) publish(null); }, [current]);
  return { invalidate, headers: authorized ? current!.headers : null, authorize, pending, error, canAuthorize };
}
