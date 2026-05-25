"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type Props = {
  onResign: () => void;
  onUndo?: () => void;
  canUndo: boolean;
  isEndState: boolean;
};

const CONFIRM_TIMEOUT_MS = 3000;

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
  const [confirmingResign, setConfirmingResign] = useState(false);
  const resignTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resignTimerRef.current) clearTimeout(resignTimerRef.current);
    };
  }, []);

  function handleResignClick() {
    if (confirmingResign) {
      if (resignTimerRef.current) clearTimeout(resignTimerRef.current);
      setConfirmingResign(false);
      onResign();
      return;
    }

    setConfirmingResign(true);
    resignTimerRef.current = setTimeout(
      () => setConfirmingResign(false),
      CONFIRM_TIMEOUT_MS,
    );
  }

  if (isEndState) return null;

  const resignLabel = t("resign");
  const resignConfirmLabel = t("resignConfirm");
  const confirmResignLabel = t("confirmResignLabel");

  return (
    <div className="arena-action-bar flex items-center justify-between px-4 pb-2 pt-2">
      <ArenaActionButton
        onClick={handleResignClick}
        ariaLabel={confirmingResign ? resignConfirmLabel : resignLabel}
        ariaPressed={confirmingResign}
        iconBase={RESIGN_ICON_BASE}
        label={confirmingResign ? confirmResignLabel : resignLabel}
      />

      <ArenaActionButton
        onClick={onUndo}
        disabled={!canUndo || !onUndo}
        ariaLabel={t("undo")}
        iconBase={UNDO_ICON_BASE}
        label={t("undo")}
      />
    </div>
  );
}
