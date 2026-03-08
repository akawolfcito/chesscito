import type { ReactNode } from "react";

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
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition disabled:opacity-35 ${
        variant === "primary"
          ? "bg-cyan-400/20 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.35)]"
          : "mission-chip text-cyan-100/80"
      }`}
    >
      <span className="text-base leading-none">{busy ? "⏳" : icon}</span>
      <span>{busy ? "..." : label}</span>
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
              <p className="text-rose-300">Usa un entero entre 1 y 9999.</p>
            ) : (
              <p className="text-emerald-300">Claim y submit usaran levelId {effectiveLevelId}.</p>
            )}
          </div>
        </details>
      ) : null}

      {/* Icon action bar */}
      <div className="flex gap-2">
        <ActionBtn icon="↺" label="Reset" onClick={onReset} disabled={isGlobalBusy} />
        <ActionBtn
          icon="🏅"
          label="Badge"
          onClick={onClaim}
          disabled={!canClaim}
          busy={isClaimBusy}
          variant="primary"
        />
        <ActionBtn
          icon="📊"
          label="Score"
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
