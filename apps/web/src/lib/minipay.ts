type BrowserProvider = {
  isMiniPay?: boolean;
};

type MiniPayWindow = Window & {
  ethereum?: BrowserProvider | null;
  provider?: BrowserProvider | null;
};

function getBrowserWindow(): MiniPayWindow | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window as MiniPayWindow;
}

export function getInjectedProvider(): BrowserProvider | null {
  const browserWindow = getBrowserWindow();

  if (!browserWindow) {
    return null;
  }

  return browserWindow.ethereum ?? browserWindow.provider ?? null;
}

export function isMiniPayEnv(): boolean {
  const browserWindow = getBrowserWindow();

  if (!browserWindow) {
    return false;
  }

  return Boolean(browserWindow.ethereum?.isMiniPay ?? browserWindow.provider?.isMiniPay);
}
