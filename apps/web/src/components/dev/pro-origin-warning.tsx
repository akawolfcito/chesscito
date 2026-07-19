"use client";

import { useEffect, useState } from "react";

import {
  classifyProOriginHost,
  publicProOriginConfiguration,
  type ProOriginClassification,
} from "@/lib/pro/pro-origin";

export function ProOriginWarning() {
  const [classification, setClassification] =
    useState<ProOriginClassification | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    setClassification(
      classifyProOriginHost(
        window.location.origin,
        publicProOriginConfiguration(),
      ),
    );
  }, []);

  if (
    process.env.NODE_ENV !== "development" ||
    classification?.status !== "mismatch"
  ) {
    return null;
  }

  return (
    <aside
      role="alert"
      data-testid="pro-origin-warning"
      className="fixed inset-x-2 top-2 z-[100] mx-auto max-w-[374px] rounded-xl border border-amber-400 bg-amber-50 px-3 py-2 text-left text-xs leading-snug text-amber-950 shadow-lg"
    >
      <strong className="block text-sm">DEV: PRO origin mismatch</strong>
      <span className="block">
        Current host <code>{classification.currentHost}</code> is not accepted
        by <code>/api/pro/status</code>.
      </span>
      <span className="mt-1 block">
        Configure both public app URLs with this ngrok host, then restart the
        local server. Accepted: {classification.allowedHosts.join(", ")}.
      </span>
      <span className="mt-1 block font-semibold">
        PRO status is unknown; no entitlement data was changed.
      </span>
    </aside>
  );
}
