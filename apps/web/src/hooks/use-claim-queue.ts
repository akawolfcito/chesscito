import { useEffect, useState, useCallback } from "react";
import { computePendingClaims, type Claim, type ClaimQueueState } from "@/lib/claims/queue";
import { readClaimSources } from "@/lib/claims/sources";
import { performClaim } from "@/lib/claims/actions";

type HookState = {
  claims: Claim[];
  isLoading: boolean;
  isClaiming: boolean;
  inFlight: Set<string>;
  error: Error | null;
};

const INITIAL: HookState = {
  claims: [],
  isLoading: false,
  isClaiming: false,
  inFlight: new Set(),
  error: null,
};

export function useClaimQueue(address: `0x${string}` | undefined) {
  const [optimisticRemoved, setOptimisticRemoved] = useState<Set<string>>(new Set());
  const [state, setState] = useState<HookState>(INITIAL);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!address) {
      setState(INITIAL);
      setOptimisticRemoved((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    readClaimSources(address)
      .then((sources) => {
        if (cancelled) return;
        const queueState: ClaimQueueState = {
          address,
          ...sources,
          optimisticRemoved,
        };
        setState({
          claims: computePendingClaims(queueState),
          isLoading: false,
          isClaiming: false,
          inFlight: new Set(),
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ ...INITIAL, error: error as Error });
      });
    return () => {
      cancelled = true;
    };
  }, [address, tick, optimisticRemoved]);

  const claimOne = useCallback(async (claim: Claim) => {
    setState((s) => ({ ...s, isClaiming: true, inFlight: new Set([...s.inFlight, claim.id]) }));
    try {
      const result = await performClaim(claim);
      if (result.ok) {
        setOptimisticRemoved((prev) => new Set([...prev, claim.id]));
      }
      setState((s) => {
        const inFlight = new Set(s.inFlight);
        inFlight.delete(claim.id);
        return { ...s, isClaiming: false, inFlight };
      });
      return result;
    } catch (error) {
      setState((s) => {
        const inFlight = new Set(s.inFlight);
        inFlight.delete(claim.id);
        return { ...s, isClaiming: false, inFlight, error: error as Error };
      });
      return { ok: false as const, error: error as Error };
    }
  }, []);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  return { ...state, claimOne, refresh };
}
