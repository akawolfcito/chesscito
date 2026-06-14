"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

type Props = {
  /** Minted token id, shown as collectible proof in the confirmation. */
  tokenId: string;
  /** Auto-dismiss callback — the parent clears its "just minted" flag. */
  onDismiss: () => void;
};

/**
 * Plan 3 review (F7) — save confirmation for the Match Review viewer.
 *
 * The viewer's Save tile minted silently (only the Share/View affordances
 * changed), so a save or re-save gave no positive feedback. This is a small
 * auto-dismissing candy toast that confirms "Saved on-chain · #N" on every
 * successful mint, including unlimited re-saves. Mounted by the viewer and
 * keyed on mint success so each re-save re-announces.
 */
export function MintSuccessToast({ tokenId, onDismiss }: Props) {
  const t = useTranslations("COACH_VIEWER_COPY");

  useEffect(() => {
    const id = setTimeout(onDismiss, 3200);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <div className="coach-mint-toast" role="status" aria-live="polite">
      <span className="coach-mint-toast__check" aria-hidden="true">
        ✓
      </span>
      <span className="coach-mint-toast__label">
        {t("mintSavedToast", { tokenId })}
      </span>
    </div>
  );
}
