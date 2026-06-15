"use client";

import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";

type Props = {
  /** When false the modal renders nothing (no scrim, no DOM). */
  open: boolean;
  title: string;
  body: string;
  /** Danger (red) primary action — confirms the destructive intent. */
  confirmLabel: string;
  /** Neutral secondary action — backs out (same as the red X / backdrop). */
  cancelLabel: string;
  closeAriaLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmTestId?: string;
};

/**
 * Shared arena confirmation modal (2026-06-15). Replaces the old inline
 * 3s-countdown "QUIT?" / "Confirm?" affordances with the canonical popup
 * vocabulary (VictoryPopupShell forest panel + red X). Used by the BACK
 * (leave match) and RESIGN flows so the player gets a clear, unmissable
 * confirmation. Backdrop tap + red X both route to `onCancel` (keep
 * playing); only the danger CTA commits.
 */
export function ArenaConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  closeAriaLabel,
  onConfirm,
  onCancel,
  confirmTestId,
}: Props) {
  if (!open) return null;
  return (
    <VictoryPopupShell
      onClose={onCancel}
      ariaLabel={title}
      closeLabel={closeAriaLabel}
    >
      <h2 className="arena-confirm-modal-title">{title}</h2>
      <p className="arena-confirm-modal-body">{body}</p>
      <div className="arena-confirm-modal-actions">
        <button
          type="button"
          onClick={onConfirm}
          data-testid={confirmTestId}
          className="arena-result-secondary-action arena-result-secondary-action--danger"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="arena-result-secondary-action"
        >
          {cancelLabel}
        </button>
      </div>
    </VictoryPopupShell>
  );
}
