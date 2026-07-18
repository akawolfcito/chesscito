"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  canUpload,
  hasBackup,
}: {
  themeId: string;
  slotKey: string;
  variant: "default" | "pro";
  canUpload: boolean;
  hasBackup: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  if (!canUpload) {
    return (
      <p className="mt-2 text-[11px] text-neutral-600">
        declare a pro override in the registry to upload
      </p>
    );
  }

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

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "uploading"}
        className="rounded-md border border-neutral-600 px-2 py-1 text-[11px] font-medium text-neutral-200 hover:border-emerald-500 disabled:opacity-50"
      >
        {status === "uploading" ? "working…" : "Replace image"}
      </button>
      {hasBackup && (
        <button
          type="button"
          onClick={onUndo}
          disabled={status === "uploading"}
          className="rounded-md border border-amber-600/60 px-2 py-1 text-[11px] font-medium text-amber-300 hover:border-amber-400 disabled:opacity-50"
        >
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
