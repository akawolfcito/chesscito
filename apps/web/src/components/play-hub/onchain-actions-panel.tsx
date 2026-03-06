import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type OnChainActionsPanelProps = {
  score: string;
  timeMs: string;
  moves: number;
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

export function OnChainActionsPanel({
  score,
  timeMs,
  moves,
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-xs text-slate-300 sm:grid-cols-4">
        <div className="mission-soft rounded-xl px-3 py-2">
          <p>Score</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">{score}</p>
        </div>
        <div className="mission-soft rounded-xl px-3 py-2">
          <p>Time</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">{timeMs} ms</p>
        </div>
        <div className="mission-soft rounded-xl px-3 py-2">
          <p>Level</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">{effectiveLevelId}</p>
        </div>
        <div className="mission-soft rounded-xl px-3 py-2">
          <p>Moves</p>
          <p className="mt-1 text-sm font-semibold text-slate-100">{moves}</p>
        </div>
      </div>

      {qaEnabled ? (
        <div className="mission-soft space-y-2 rounded-xl px-3 py-3 text-xs text-slate-300">
          <p className="font-semibold uppercase tracking-[0.2em] text-cyan-300">QA mode</p>
          <label className="block">
            Level ID override
            <input
              type="number"
              min={1}
              max={9999}
              step={1}
              value={qaLevelInput}
              onChange={(event) => onQaLevelInputChange(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          {!isQaLevelValid ? (
            <p className="text-rose-300">Usa un entero entre 1 y 9999.</p>
          ) : (
            <p className="text-emerald-300">Claim y submit usaran levelId {effectiveLevelId}.</p>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button disabled={!canClaim || isClaimBusy || isGlobalBusy} onClick={onClaim}>
          {isClaimBusy ? "Confirmando claim..." : "Claim badge"}
        </Button>
        <Button variant="outline" disabled={!canSubmit || isSubmitBusy || isGlobalBusy} onClick={onSubmit}>
          {isSubmitBusy ? "Confirmando score..." : "Guardar score"}
        </Button>
        {shopControl}
        {leaderboardControl}
      </div>

      <Button variant="outline" onClick={onReset}>
        Reset board
      </Button>
    </div>
  );
}
