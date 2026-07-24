"use client";

import { usePrivy, useLogin } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";
import { trackWebAccess, WEB_ACCESS_EVENTS } from "@/lib/wallet/web-access-analytics";
import {
  resolveWebAccessSurface,
  WEB_ACCESS_COPY,
  type ProductSurface,
} from "@/lib/wallet/web-access-copy";
import { deriveWebAccessState } from "@/lib/wallet/web-access-state";

/** Where the error escape hatches lead. The discovery app lives on the apex;
 *  MiniPay bypasses the gate entirely, so its link re-enters that flow. */
const DISCOVERY_URL = "https://chesscito.com";
const MINIPAY_URL = "https://www.opera.com/products/minipay";

/**
 * Mandatory access gate for the web (Privy) branch. Renders productive
 * `children` ONLY once Privy reports an authenticated session AND wagmi exposes
 * an embedded-wallet address. Every other state is a shell, the gate, or an
 * interstitial — there is no `Continue as Guest`.
 *
 * MiniPay never mounts this: the wallet branch resolver keeps MiniPay on the
 * `injected` tree, so this component is unreachable from that environment.
 *
 * `surface` is derived from the build mode (`CHESSCITO_MODE`), never from the
 * hostname — Learn and Play are separate deploys of the same app and differ
 * only in one copy line.
 */
export function WebAccessGate({
  children,
  surface = resolveWebAccessSurface(),
}: {
  children: ReactNode;
  surface?: ProductSurface;
}) {
  const { ready, authenticated } = usePrivy();
  const { address } = useAccount();
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState(false);

  const { login } = useLogin({
    onComplete: () => {
      setAuthenticating(false);
      setError(false);
    },
    onError: () => {
      setAuthenticating(false);
      setError(true);
    },
  });

  const walletReady = Boolean(address);
  const state = deriveWebAccessState({
    ready,
    authenticated,
    walletReady,
    authenticating,
    error,
  });

  // Analytics. `login_succeeded` is a genuine transition (false→true this
  // session), so its ref seeds from the mount value: a restored session that is
  // already authenticated did not just log in. `gate_viewed`, `wallet_ready`
  // and `login_failed` are milestones reported once regardless of mount, so
  // their refs seed from false. Names and payload live in the analytics module,
  // which is PII-free by construction.
  const gateViewed = useRef(false);
  const wasAuthenticated = useRef(authenticated);
  const walletReadyReported = useRef(false);
  const failureReported = useRef(false);

  useEffect(() => {
    if (state === "unauthenticated" && !gateViewed.current) {
      gateViewed.current = true;
      trackWebAccess(WEB_ACCESS_EVENTS.gateViewed, surface);
    }
    if (authenticated && !wasAuthenticated.current) {
      trackWebAccess(WEB_ACCESS_EVENTS.loginSucceeded, surface);
    }
    wasAuthenticated.current = authenticated;
    if (walletReady && !walletReadyReported.current) {
      walletReadyReported.current = true;
      trackWebAccess(WEB_ACCESS_EVENTS.walletReady, surface);
    }
    if (state === "error" && !failureReported.current) {
      failureReported.current = true;
      trackWebAccess(WEB_ACCESS_EVENTS.loginFailed, surface);
    }
    if (state !== "error") {
      failureReported.current = false;
    }
  }, [state, authenticated, walletReady, surface]);

  function startLogin() {
    setError(false);
    setAuthenticating(true);
    trackWebAccess(WEB_ACCESS_EVENTS.loginStarted, surface);
    login();
  }

  if (state === "wallet-ready") {
    return <>{children}</>;
  }

  if (state === "environment-loading") {
    return (
      <div
        data-web-access="environment-loading"
        className="flex min-h-screen items-center justify-center"
        aria-busy="true"
      />
    );
  }

  if (state === "wallet-pending") {
    return (
      <div
        data-web-access="wallet-pending"
        role="status"
        className="flex min-h-screen items-center justify-center px-6 text-center"
      >
        <p className="text-base font-medium">{WEB_ACCESS_COPY.preparing}</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        data-web-access="error"
        role="alert"
        className="mx-auto flex min-h-screen max-w-[390px] flex-col items-center justify-center gap-4 px-6 text-center"
      >
        <p className="text-base font-medium">{WEB_ACCESS_COPY.error.title}</p>
        <Button variant="game-primary" size="game" onClick={startLogin}>
          {WEB_ACCESS_COPY.error.retry}
        </Button>
        <Button asChild variant="game-ghost" size="game">
          <a href={MINIPAY_URL}>{WEB_ACCESS_COPY.error.openMiniPay}</a>
        </Button>
        <Button asChild variant="game-text" size="game-sm">
          <a href={DISCOVERY_URL}>{WEB_ACCESS_COPY.error.backToDiscovery}</a>
        </Button>
      </div>
    );
  }

  // `unauthenticated` / `authenticating` — the gate itself.
  return (
    <div
      data-web-access={state}
      className="mx-auto flex min-h-screen max-w-[390px] flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <h1 className="font-action text-xl font-bold">
        {WEB_ACCESS_COPY.surfaceHeadline[surface]}
      </h1>
      <p className="text-lg font-semibold">{WEB_ACCESS_COPY.title}</p>
      <p className="text-sm opacity-80">{WEB_ACCESS_COPY.subtitle}</p>
      <Button
        variant="game-primary"
        size="game"
        onClick={startLogin}
        disabled={authenticating}
      >
        {WEB_ACCESS_COPY.cta}
      </Button>
      <p className="text-xs opacity-70">{WEB_ACCESS_COPY.note}</p>
      {/* No `Continue as Guest`: web access is mandatory by product decision. */}
    </div>
  );
}
