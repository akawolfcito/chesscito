import type { ReactNode } from "react";
import { CTA_LABELS } from "@/lib/content/editorial";

type OnChainActionsPanelProps = {
  effectiveLevelId: string;
  canClaim: boolean;
  canSubmit: boolean;
  isClaimBusy: boolean;
  isSubmitBusy: boolean;
  isGlobalBusy: boolean;
  qaEnabled: boolean;
  qaLevelInput: string;
  isQaLevelValid: boolean;
  onQaLevelInputChange: (next: string) => void;
  onClaim: () => void;
  onSubmit: () => void;
  onReset: () => void;
  shopControl: ReactNode;
  leaderboardControl: ReactNode;
};

function ActionBtn({
  icon,
  label,
  onClick,
  disabled,
  busy,
  variant = "default",
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: "default" | "primary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-label={busy ? `${label} in progress` : label}
      className={`relative flex h-14 flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl transition disabled:opacity-35 ${
        variant === "primary"
          ? "bg-cyan-400/20 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.35)]"
          : "mission-chip text-cyan-100/80"
      }`}
    >
      {busy ? (
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/85">...</span>
      ) : (
        <img src={icon} alt="" aria-hidden="true" className="h-full w-full object-contain p-1" />
      )}
    </button>
  );
}

export function OnChainActionsPanel({
  effectiveLevelId,
  canClaim,
  canSubmit,
  isClaimBusy,
  isSubmitBusy,
  isGlobalBusy,
  qaEnabled,
  qaLevelInput,
  isQaLevelValid,
  onQaLevelInputChange,
  onClaim,
  onSubmit,
  onReset,
  shopControl,
  leaderboardControl,
}: OnChainActionsPanelProps) {
  return (
    <div className="space-y-2">
      {qaEnabled ? (
        <details className="mission-soft rune-frame rounded-xl px-3 py-2 text-xs text-slate-200">
          <summary className="cursor-pointer list-none font-semibold uppercase tracking-[0.2em] text-cyan-300">
            QA mode
          </summary>
          <div className="mt-2 space-y-2">
            <label className="block">
              Level ID override
              <input
                type="number"
                min={1}
                max={9999}
                step={1}
                value={qaLevelInput}
                onChange={(event) => onQaLevelInputChange(event.target.value)}
                className="mt-1 w-full rounded-lg border border-cyan-600/45 bg-slate-900/90 px-3 py-2 text-sm text-cyan-50"
              />
            </label>
            {!isQaLevelValid ? (
              <p className="text-rose-300">Use a whole number between 1 and 9999.</p>
            ) : (
              <p className="text-emerald-300">{CTA_LABELS.claimBadge} and {CTA_LABELS.submitScore} will use levelId {effectiveLevelId}.</p>
            )}
          </div>
        </details>
      ) : null}

      {/* Icon action bar */}
      <div className="flex gap-2">
        <ActionBtn icon="/art/refresh-chesscito.png" label={CTA_LABELS.resetTrial} onClick={onReset} disabled={isGlobalBusy} />
        <ActionBtn
          icon="/art/badge-chesscito.png"
          label={CTA_LABELS.claimBadge}
          onClick={onClaim}
          disabled={!canClaim}
          busy={isClaimBusy}
          variant="primary"
        />
        <ActionBtn
          icon="/art/score-chesscito.png"
          label={CTA_LABELS.submitScore}
          onClick={onSubmit}
          disabled={!canSubmit}
          busy={isSubmitBusy}
          variant="primary"
        />
        {shopControl}
        {leaderboardControl}
      </div>
    </div>
  );
}
