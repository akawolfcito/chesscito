import { notFound } from "next/navigation";

import { TxProgressFixture } from "./fixture";
import type { TxStepCode, TxFlowName } from "@/components/redesign/tx-progress-steps";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const STEP_CODES: ReadonlySet<TxStepCode> = new Set([
  "prepare",
  "sign",
  "send",
  "wait",
  "verify",
]);

const FLOW_NAMES: ReadonlySet<TxFlowName> = new Set([
  "save-score",
  "claim-badge",
  "mint-victory",
  "shop-buy",
  "pro-buy",
]);

function parseSteps(raw: string | undefined): TxStepCode[] {
  if (!raw) return ["sign", "send", "wait"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is TxStepCode => STEP_CODES.has(s as TxStepCode));
}

function parseCurrent(raw: string | undefined): TxStepCode | "done" | "failed" {
  if (raw === "done" || raw === "failed") return raw;
  if (raw && STEP_CODES.has(raw as TxStepCode)) return raw as TxStepCode;
  return "sign";
}

function parseFlow(raw: string | undefined): TxFlowName {
  if (raw && FLOW_NAMES.has(raw as TxFlowName)) return raw as TxFlowName;
  return "mint-victory";
}

function parseVariant(raw: string | undefined): "pills" | "toast" {
  return raw === "toast" ? "toast" : "pills";
}

export default function TxProgressDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const variant = parseVariant(
    typeof searchParams.variant === "string" ? searchParams.variant : undefined,
  );
  const flow = parseFlow(
    typeof searchParams.flow === "string" ? searchParams.flow : undefined,
  );
  const current = parseCurrent(
    typeof searchParams.current === "string" ? searchParams.current : undefined,
  );
  const steps = parseSteps(
    typeof searchParams.steps === "string" ? searchParams.steps : undefined,
  );
  const title =
    typeof searchParams.title === "string" ? searchParams.title : undefined;
  const errorMessage =
    typeof searchParams.errorMessage === "string"
      ? searchParams.errorMessage
      : undefined;

  return (
    <TxProgressFixture
      variant={variant}
      flow={flow}
      current={current}
      steps={steps}
      title={title}
      errorMessage={errorMessage}
    />
  );
}
