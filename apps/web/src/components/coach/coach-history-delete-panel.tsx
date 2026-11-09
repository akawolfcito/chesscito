"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { buildDeleteMessage } from "@/lib/coach/delete-message";
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
 * Delete-by-self surface for Coach history. Renders a collapsed "Manage
 * history" toggle; on expand, shows the existing delete button + confirm
 * sheet flow — unchanged from the original implementation.
 *
 * Red-team:
 * - P0-7 — button is disabled when rowCount === 0; success text is
 *   neutral so we never imply a positive action that may not have
 *   happened.
 * - P0-1 / P0-8 — nonce + signature flow handled server-side; this
 *   component just generates the nonce and forwards the signature.
 *
 * The signed message comes straight from `lib/coach/delete-message.ts`
 * (locale-agnostic, shared with the server) so a locale switch never
 * desyncs the client signature from the server verifier.
 *
 * Spec §9.2.
 */
export function CoachHistoryDeletePanel() {
  const t = useTranslations("COACH_COPY");
  const { address } = useAccount();
  const { rowCount, isLoading, refetch } = useCoachHistoryCount(address);
  const { signMessageAsync } = useSignMessage();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [manageOpen, setManageOpen] = useState(false);

  if (!address) return null;

  const hasHistory = (rowCount ?? 0) > 0;
  const manageLabel = manageOpen ? t("manageHistoryClose") : t("manageHistoryOpen");

  async function signAndDelete() {
    if (!address) return;
    setStatus("working");
    try {
      const nonce = generateNonce();
      const issuedIso = new Date().toISOString();
      const message = buildDeleteMessage(nonce, issuedIso);
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
    <section className="tj-manage-history-section">
      {/* Toggle trigger — muted text-link style */}
      <button
        type="button"
        onClick={() => setManageOpen((o) => !o)}
        className="tj-manage-history-toggle"
        aria-expanded={manageOpen}
      >
        <span>{manageLabel}</span>
        <span className="tj-manage-history-toggle-chevron" aria-hidden="true">
          {manageOpen ? "▲" : "▼"}
        </span>
      </button>

      {/* Collapsible delete surface — behavior completely unchanged */}
      {manageOpen && (
        <div className="tj-manage-history-body">
          <h3 className="tj-manage-history-title">
            {t("historyDelete.title")}
          </h3>
          <p className="tj-manage-history-body-text">
            {t("historyDelete.body")}
          </p>
          <Button
            type="button"
            variant="destructive"
            size="game-sm"
            onClick={() => setConfirmOpen(true)}
            disabled={isLoading || !hasHistory || status === "working"}
            className="mt-3"
          >
            {t("historyDelete.cta")}
          </Button>
          {status === "success" && (
            <p
              data-testid="coach-history-delete-status-success"
              className="mt-2 text-xs text-emerald-400"
            >
              {t("historyDelete.successToast")}
            </p>
          )}
          {status === "error" && (
            <p
              data-testid="coach-history-delete-status-error"
              className="mt-2 text-xs text-rose-400"
            >
              {t("historyDelete.errorToast")}
            </p>
          )}
        </div>
      )}

      <ConfirmDeleteSheet
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o && status === "working") setStatus("idle");
        }}
        title={t("historyDelete.confirmTitle")}
        body={t("historyDelete.confirmBody")}
        confirmLabel={t("historyDelete.confirmAccept")}
        cancelLabel={t("historyDelete.confirmCancel")}
        onConfirm={signAndDelete}
        isWorking={status === "working"}
      />
    </section>
  );
}
