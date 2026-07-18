"use client";

import { useState } from "react";

/** Copy a slot's asset path to the clipboard so it can be shared/pasted.
 *  Dev-tool only. */
export function CopyPathButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard blocked (non-secure context) — no-op; the path stays visible.
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      title={`Copy ${path}`}
      className="shrink-0 rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400 hover:border-emerald-500 hover:text-emerald-300"
    >
      {copied ? "copied ✓" : "copy"}
    </button>
  );
}
