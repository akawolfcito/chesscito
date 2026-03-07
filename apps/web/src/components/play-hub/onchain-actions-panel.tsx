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
      <div className="grid grid-cols-2 gap-3 text-xs text-slate-200 sm:grid-cols-4">
        <div className="mission-soft rune-frame rounded-xl px-3 py-2">
          <p>Score</p>
          <p className="mt-1 text-sm font-semibold text-cyan-100">{score}</p>
        </div>
        <div className="mission-soft rune-frame rounded-xl px-3 py-2">
          <p>Time</p>
          <p className="mt-1 text-sm font-semibold text-cyan-100">{timeMs} ms</p>
        </div>
        <div className="mission-soft rune-frame rounded-xl px-3 py-2">
          <p>Level</p>
          <p className="mt-1 text-sm font-semibold text-cyan-100">{effectiveLevelId}</p>
        </div>
        <div className="mission-soft rune-frame rounded-xl px-3 py-2">
          <p>Moves</p>
          <p className="mt-1 text-sm font-semibold text-cyan-100">{moves}</p>
        </div>
      </div>

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

      <div className="grid grid-cols-2 gap-2">
        <Button className="bg-cyan-300 text-slate-900 hover:bg-cyan-200" disabled={!canClaim || isClaimBusy || isGlobalBusy} onClick={onClaim}>
          {isClaimBusy ? "Confirmando claim..." : "Claim badge"}
        </Button>
        <Button className="border-cyan-500/40 text-cyan-100 hover:bg-cyan-900/35" variant="outline" disabled={!canSubmit || isSubmitBusy || isGlobalBusy} onClick={onSubmit}>
          {isSubmitBusy ? "Confirmando score..." : "Guardar score"}
        </Button>
        {shopControl}
        {leaderboardControl}
      </div>

      <Button className="border-cyan-500/40 text-cyan-100 hover:bg-cyan-900/35" variant="outline" onClick={onReset}>
        Reset board
      </Button>
    </div>
  );
}
