"use client";

import {
  TxProgressSteps,
  type TxFlowName,
  type TxStepCode,
} from "@/components/redesign/tx-progress-steps";

type Props = {
  variant: "pills" | "toast";
  flow: TxFlowName;
  current: TxStepCode | "done" | "failed";
  steps: TxStepCode[];
  title?: string;
  errorMessage?: string;
};

export function TxProgressFixture({
  variant,
  flow,
  current,
  steps,
  title,
  errorMessage,
}: Props) {
  return (
    <main
      data-testid="dev-tx-progress-root"
      className="min-h-[100dvh] w-full flex items-center justify-center bg-[#1a0f0a] px-4 py-8"
    >
      <div className="w-full max-w-[var(--app-max-width,390px)]">
        <TxProgressSteps
          variant={variant}
          flow={flow}
          current={current}
          steps={steps.map((code) => ({ code }))}
          title={title}
          errorMessage={errorMessage}
        />
      </div>
    </main>
  );
}
