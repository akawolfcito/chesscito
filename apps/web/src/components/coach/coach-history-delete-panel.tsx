"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { Button } from "@/components/ui/button";
import { COACH_COPY } from "@/lib/content/editorial";
import { useCoachHistoryCount } from "@/lib/coach/use-coach-history-count";
import { ConfirmDeleteSheet } from "./confirm-delete-sheet";

type Status = "idle" | "working" | "success" | "error";

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Delete-by-self surface for Coach history. Renders a button + confirm
 * sheet; on confirm, generates a nonce, signs the chain/domain-bound
 * message, and POSTs to DELETE /api/coach/history.
 *
 * Red-team:
 * - P0-7 — button is disabled when rowCount === 0; success text is
 *   neutral ("All Coach data cleared from our records") so we never
 *   imply a positive action that may not have happened.
 * - P0-1 / P0-8 — nonce + signature flow handled server-side; this
 *   component just generates the nonce and forwards the signature.
 *
 * Spec §9.2.
 */
export function CoachHistoryDeletePanel() {
  const { address } = useAccount();
  const { rowCount, isLoading, refetch } = useCoachHistoryCount(address);
  const { signMessageAsync } = useSignMessage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  if (!address) return null;

  const hasHistory = (rowCount ?? 0) > 0;

  async function signAndDelete() {
    if (!address) return;
    setStatus("working");
    try {
      const nonce = generateNonce();
      const issuedIso = new Date().toISOString();
      const message = COACH_COPY.historyDelete.signMessage(nonce, issuedIso);
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/coach/history", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          signature,
          nonce,
          issuedIso,
        }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setStatus("success");
      setConfirmOpen(false);
      refetch();
    } catch {
      // User cancelled wallet sign, or network error.
      setStatus("error");
    }
  }

  return (
    <section className="mt-8 border-t border-white/10 pt-4">
      <h3 className="text-sm font-bold text-rose-200">{COACH_COPY.historyDelete.title}</h3>
      <p className="mt-1 text-xs text-white/65">{COACH_COPY.historyDelete.body}</p>
      <Button
        type="button"
        variant="destructive"
        size="game-sm"
        onClick={() => setConfirmOpen(true)}
        disabled={isLoading || !hasHistory || status === "working"}
        className="mt-3"
      >
        {COACH_COPY.historyDelete.cta}
      </Button>
      {status === "success" && (
        <p data-testid="coach-history-delete-status-success" className="mt-2 text-xs text-emerald-400">
          {COACH_COPY.historyDelete.successToast}
        </p>
      )}
      {status === "error" && (
        <p data-testid="coach-history-delete-status-error" className="mt-2 text-xs text-rose-400">
          {COACH_COPY.historyDelete.errorToast}
        </p>
      )}
      <ConfirmDeleteSheet
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o && status === "working") setStatus("idle");
        }}
        title={COACH_COPY.historyDelete.confirmTitle}
        body={COACH_COPY.historyDelete.confirmBody}
        confirmLabel={COACH_COPY.historyDelete.confirmAccept}
        cancelLabel={COACH_COPY.historyDelete.confirmCancel}
        onConfirm={signAndDelete}
        isWorking={status === "working"}
      />
    </section>
  );
}
