"use client";

import { useEffect } from "react";
import { isChesscitoStorageKey } from "@/lib/lite-progress-storage";

function clearChesscitoStorage(storage: Storage): void {
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (isChesscitoStorageKey(key)) storage.removeItem(key!);
    }
  } catch {
    // Storage can be blocked by WebView privacy settings. Continue cleanup.
  }
}

async function clearChesscitoIndexedDb(): Promise<void> {
  try {
    if (typeof indexedDB.databases !== "function") return;
    const databases = await indexedDB.databases();
    await Promise.allSettled(
      databases
        .map((database) => database.name)
        .filter((name): name is string => Boolean(name?.startsWith("chesscito")))
        .map(
          (name) =>
            new Promise<void>((resolve) => {
              const request = indexedDB.deleteDatabase(name);
              const timeout = window.setTimeout(resolve, 500);
              const finish = () => {
                window.clearTimeout(timeout);
                resolve();
              };
              request.addEventListener("success", finish, { once: true });
              request.addEventListener("error", finish, { once: true });
              request.addEventListener("blocked", finish, { once: true });
            }),
        ),
    );
  } catch {
    // IndexedDB is optional and not uniformly exposed by MiniPay WebViews.
  }
}

async function clearCacheStorage(): Promise<void> {
  try {
    if (!("caches" in window)) return;
    const names = await caches.keys();
    await Promise.allSettled(names.map((name) => caches.delete(name)));
  } catch {
    // Cache Storage is optional. A failure must never prevent the clean reload.
  }
}

function liteHubPath(): string {
  const locale = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("NEXT_LOCALE="))
    ?.split("=")[1];
  return locale === "es" ? "/es/hub" : "/hub";
}

/** Hidden, server-gated QA action. It has no user-facing controls. */
export function LiteResetClient() {
  useEffect(() => {
    void (async () => {
      // Each storage family is deliberately isolated so a WebView failure in
      // one does not skip the others or block the final reload.
      clearChesscitoStorage(window.localStorage);
      clearChesscitoStorage(window.sessionStorage);
      await Promise.allSettled([clearChesscitoIndexedDb(), clearCacheStorage()]);
      window.location.replace(liteHubPath());
    })();
  }, []);

  return <p className="sr-only" aria-live="polite">Resetting Lite QA state.</p>;
}
