"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ArenaConfirmModal } from "@/components/arena/arena-confirm-modal";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import type { ThemeAssetKey } from "@/lib/themes/theme-registry";

type Props = {
  onResign: () => void;
  onUndo?: () => void;
  canUndo: boolean;
  isEndState: boolean;
};

type ArenaActionButtonProps = {
  onClick?: () => void;
  disabled?: boolean;
  ariaLabel: string;
  ariaPressed?: boolean;
  iconSlot: ThemeAssetKey;
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
  iconSlot,
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
      <ThemeAssetPicture slot={iconSlot} pictureClassName="arena-action-button-icon" alt="" aria-hidden="true" />
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
        iconSlot="arena.resign"
        label={resignLabel}
      />

      <ArenaActionButton
        onClick={isHidden ? undefined : onUndo}
        disabled={isHidden || !canUndo || !onUndo}
        ariaLabel={t("undo")}
        iconSlot="arena.undo"
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
