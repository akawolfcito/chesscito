"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ArenaConfirmModal } from "@/components/arena/arena-confirm-modal";

type Props = {
  onResign: () => void;
  onUndo?: () => void;
  canUndo: boolean;
  isEndState: boolean;
};

const RESIGN_ICON_BASE = "/art/new-assets-chesscito/arena/resign-game";
const UNDO_ICON_BASE = "/art/new-assets-chesscito/arena/undo-move";

type ArenaActionButtonProps = {
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel: string;
  ariaPressed?: boolean;
  iconBase: string;
  label: string;
};

/** Icon + label action — no circular background plate. The asset's
 *  own carved silhouette carries the visual weight, the warm-amber
 *  label below names the action. Matches the "icon dominant, chip
 *  emerges" pattern used by the HUD chips elsewhere in the app. */
function ArenaActionButton({
  onClick,
  disabled = false,
  ariaLabel,
  ariaPressed,
  iconBase,
  label,
}: ArenaActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      className="arena-action-button"
    >
      <picture className="arena-action-button-icon">
        <source srcSet={`${iconBase}.avif`} type="image/avif" />
        <source srcSet={`${iconBase}.webp`} type="image/webp" />
        <img src={`${iconBase}.png`} alt="" aria-hidden="true" />
      </picture>
      <span className="arena-action-button-label">{label}</span>
    </button>
  );
}

export function ArenaActionBar({
  onResign,
  onUndo,
  canUndo,
  isEndState,
}: Props) {
  const t = useTranslations("ARENA_COPY");
  const [resignModalOpen, setResignModalOpen] = useState(false);

  const resignLabel = t("resign");

  /* When the match ends we still RENDER the action bar (same DOM
   * structure + size) but hide it visually. Returning null would
   * remove the row from the flex column and the board / HUD above
   * would jump down to fill the gap — a layout flash the player
   * notices on every endgame. `visibility: hidden` preserves the
   * footprint; `aria-hidden` keeps screen readers from announcing
   * the dead controls. */
  const isHidden = isEndState;

  return (
    <div
      className="arena-action-bar flex items-center justify-between px-4 pb-2 pt-2"
      style={isHidden ? { visibility: "hidden" } : undefined}
      aria-hidden={isHidden || undefined}
    >
      <ArenaActionButton
        onClick={isHidden ? undefined : () => setResignModalOpen(true)}
        disabled={isHidden}
        ariaLabel={resignLabel}
        iconBase={RESIGN_ICON_BASE}
        label={resignLabel}
      />

      <ArenaActionButton
        onClick={isHidden ? undefined : onUndo}
        disabled={isHidden || !canUndo || !onUndo}
        ariaLabel={t("undo")}
        iconBase={UNDO_ICON_BASE}
        label={t("undo")}
      />

      <ArenaConfirmModal
        open={resignModalOpen}
        title={t("resignModalTitle")}
        body={t("resignModalBody")}
        confirmLabel={t("resignModalConfirm")}
        cancelLabel={t("resignModalCancel")}
        closeAriaLabel={t("confirmModalCloseAria")}
        confirmTestId="arena-resign-confirm"
        onConfirm={() => {
          setResignModalOpen(false);
          onResign();
        }}
        onCancel={() => setResignModalOpen(false)}
      />
    </div>
  );
}
