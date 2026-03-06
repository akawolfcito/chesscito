import Link from "next/link";

type Tone = "pending" | "success" | "error";

const toneClasses: Record<Tone, string> = {
  pending: "border-sky-700/60 bg-sky-900/35 text-sky-200",
  success: "border-emerald-700/60 bg-emerald-900/30 text-emerald-200",
  error: "border-rose-700/60 bg-rose-900/30 text-rose-200",
};

type TxFeedbackCardProps = {
  tone: Tone;
  title: string;
  message: string;
  txHash?: string | null;
  txHref?: string;
};

export function TxFeedbackCard({ tone, title, message, txHash, txHref }: TxFeedbackCardProps) {
  return (
    <div className={`rounded-2xl border px-3 py-2 text-xs ${toneClasses[tone]}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1">{message}</p>
      {txHash ? <p className="mt-2 break-all font-mono">{txHash}</p> : null}
      {txHash && txHref ? (
        <Link className="mt-2 inline-flex font-semibold underline underline-offset-2" href={txHref} rel="noopener noreferrer" target="_blank">
          Ver en CeloScan
        </Link>
      ) : null}
    </div>
  );
}
