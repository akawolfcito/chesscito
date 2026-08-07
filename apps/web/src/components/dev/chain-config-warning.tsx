"use client";

import { diagnoseChainConfiguration } from "@/lib/contracts/chain-config-diagnosis";
import { getConfiguredChainId } from "@/lib/contracts/chains";

/**
 * Local-only banner for the failure that hid in plain sight for months: the
 * app configured for one chain while wagmi defaults a disconnected visitor to
 * another. Nothing throws and no request fails — every contract address just
 * resolves to null and the UI degrades into "Coming soon", which reads like a
 * missing deploy rather than a misconfiguration.
 *
 * Unlike `ProOriginWarning` this reads no browser state, so it renders the
 * same on server and client and needs no effect.
 *
 * `defaultChainId` is the caller's `chains[0]` — the two wallet providers do
 * not configure the same chain list, so neither may assume the other's.
 */
export function ChainConfigWarning({
  defaultChainId,
}: {
  defaultChainId: number;
}) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const diagnosis = diagnoseChainConfiguration({
    configuredChainId: getConfiguredChainId(),
    defaultChainId,
  });

  if (diagnosis.status === "ok") {
    return null;
  }

  return (
    <aside
      role="alert"
      data-testid="chain-config-warning"
      className="fixed inset-x-2 top-2 z-[100] mx-auto max-w-[374px] rounded-xl border border-amber-400 bg-amber-50 px-3 py-2 text-left text-xs leading-snug text-amber-950 shadow-lg"
    >
      <strong className="block text-sm">DEV: chain id mismatch</strong>
      {diagnosis.status === "unset" ? (
        <span className="block">
          <code>NEXT_PUBLIC_CHAIN_ID</code> is missing or not a supported chain.
          The wallet defaults to <code>{diagnosis.defaultChainId}</code>.
        </span>
      ) : (
        <span className="block">
          App is configured for <code>{diagnosis.configuredChainId}</code> while
          a disconnected visitor gets <code>{diagnosis.defaultChainId}</code>.
        </span>
      )}
      <span className="mt-1 block">
        Contract addresses resolve to null, so the Shop and badges render
        &ldquo;Coming soon&rdquo;. A shell export wins over local env files —
        check <code>echo $NEXT_PUBLIC_CHAIN_ID</code> before changing code.
      </span>
    </aside>
  );
}
