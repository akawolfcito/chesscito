"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Upload } from "lucide-react";

type Status = "idle" | "uploading" | "done" | "error";

/**
 * Per-variant uploader for the theme-builder catalog. Posts the chosen
 * image to /api/dev/theme-asset, which writes the PNG/WebP/AVIF triplet
 * to the registry-declared path, then refreshes the server component so
 * the new art + dimensions render. Dev/local only.
 */
export function UploadControl({
  themeId,
  slotKey,
  variant,
  mode,
  hasBackup,
}: {
  themeId: string;
  slotKey: string;
  variant: "default" | "pro";
  mode: "asset" | "inherit" | "none";
  hasBackup: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setMessage("uploading…");

    const form = new FormData();
    form.set("themeId", themeId);
    form.set("key", slotKey);
    form.set("variant", variant);
    form.set("file", file);

    try {
      const res = await fetch("/api/dev/theme-asset", { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; width?: number; height?: number; error?: string }
        | null;
      if (res.ok && data?.ok) {
        setStatus("done");
        setMessage(`saved · ${data.width}×${data.height}`);
        router.refresh();
      } else {
        setStatus("error");
        setMessage(data?.error ?? `failed (${res.status})`);
      }
    } catch {
      setStatus("error");
      setMessage("network error");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onUndo() {
    setStatus("uploading");
    setMessage("undoing…");
    const form = new FormData();
    form.set("themeId", themeId);
    form.set("key", slotKey);
    form.set("variant", variant);
    form.set("action", "undo");
    try {
      const res = await fetch("/api/dev/theme-asset", { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (res.ok && data?.ok) {
        setStatus("done");
        setMessage("reverted to previous");
        router.refresh();
      } else {
        setStatus("error");
        setMessage(data?.error ?? `failed (${res.status})`);
      }
    } catch {
      setStatus("error");
      setMessage("network error");
    }
  }

  async function setMode(nextMode: "inherit" | "none") {
    setStatus("uploading");
    setMessage("saving…");
    const form = new FormData();
    form.set("themeId", themeId);
    form.set("key", slotKey);
    form.set("variant", variant);
    form.set("action", "set-mode");
    form.set("mode", nextMode);
    try {
      const res = await fetch("/api/dev/theme-asset", { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (res.ok && data?.ok) {
        setStatus("done");
        setMessage(`set to ${nextMode}`);
        router.refresh();
      } else {
        setStatus("error");
        setMessage(data?.error ?? `failed (${res.status})`);
      }
    } catch {
      setStatus("error");
      setMessage("network error");
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "uploading"}
        className="inline-flex items-center gap-1 rounded-md border border-neutral-600 px-2 py-1 text-[11px] font-medium text-neutral-200 hover:border-emerald-500 disabled:opacity-50"
      >
        <Upload aria-hidden="true" className="h-3 w-3" />
        {status === "uploading" ? "working…" : "Replace image"}
      </button>
      {variant === "pro" && (
        <button
          type="button"
          onClick={() => setMode("inherit")}
          disabled={status === "uploading" || mode === "inherit"}
          className="rounded-md border border-neutral-700 px-2 py-1 text-[11px] font-medium text-neutral-300 hover:border-emerald-500 disabled:opacity-40"
        >
          Inherit
        </button>
      )}
      <button
        type="button"
        onClick={() => setMode("none")}
        disabled={status === "uploading" || mode === "none"}
        className="rounded-md border border-neutral-700 px-2 py-1 text-[11px] font-medium text-neutral-300 hover:border-emerald-500 disabled:opacity-40"
      >
        None
      </button>
      {hasBackup && (
        <button
          type="button"
          onClick={onUndo}
          disabled={status === "uploading"}
          className="inline-flex items-center gap-1 rounded-md border border-amber-600/60 px-2 py-1 text-[11px] font-medium text-amber-300 hover:border-amber-400 disabled:opacity-50"
        >
          <RotateCcw aria-hidden="true" className="h-3 w-3" />
          Undo
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onFile}
        className="hidden"
      />
      {message && (
        <span
          className={
            status === "error"
              ? "ml-2 text-[11px] text-red-300"
              : "ml-2 text-[11px] text-emerald-300"
          }
        >
          {message}
        </span>
      )}
    </div>
  );
}
