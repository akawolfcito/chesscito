"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { isMiniPayEnv } from "@/lib/minipay";

const ONBOARDED_KEY = "chesscito:onboarded";

/** Critical images to preload before revealing the game. */
const PRELOAD_ASSETS = [
  "/art/redesign/board/board-ch.png",
  "/art/redesign/bg/bg-ch.png",
];

/** Max time (ms) to wait before revealing anyway. */
const WALLET_TIMEOUT = 5_000;
const ASSET_TIMEOUT = 3_000;

function readOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, "true");
  } catch {
    // localStorage unavailable — silent
  }
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // don't block on failures
    img.src = src;
    // Timeout per image
    setTimeout(resolve, ASSET_TIMEOUT);
  });
}

type SplashState = {
  /** True while splash is visible (loading assets/wallet) */
  showSplash: boolean;
  /** True if this is the user's first visit (show briefing after splash) */
  showBriefing: boolean;
  /** Call when briefing is dismissed (or splash finishes for returning users) */
  markOnboarded: () => void;
};

export function useSplashLoader(): SplashState {
  const { isConnected } = useAccount();
  const [isFirstVisit] = useState(() => !readOnboarded());
  const [assetsReady, setAssetsReady] = useState(false);
  const [walletReady, setWalletReady] = useState(false);

  // Preload critical images
  useEffect(() => {
    Promise.all(PRELOAD_ASSETS.map(preloadImage)).then(() => {
      setAssetsReady(true);
    });
  }, []);

  // Track wallet readiness
  useEffect(() => {
    if (isConnected) {
      setWalletReady(true);
      return;
    }

    // In MiniPay, wait for wallet with timeout
    // Outside MiniPay, don't block on wallet
    if (!isMiniPayEnv()) {
      setWalletReady(true);
      return;
    }

    const timer = setTimeout(() => setWalletReady(true), WALLET_TIMEOUT);
    return () => clearTimeout(timer);
  }, [isConnected]);

  const loaded = assetsReady && walletReady;

  // Always show splash while loading assets/wallet
  // Briefing only on first visit (after splash finishes)
  const showSplash = !loaded;
  const showBriefing = isFirstVisit && loaded;

  function markOnboarded() {
    writeOnboarded();
  }

  return { showSplash, showBriefing, markOnboarded };
}
