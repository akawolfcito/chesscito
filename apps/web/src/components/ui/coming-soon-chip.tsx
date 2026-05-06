import { PRO_COPY } from "@/lib/content/editorial";

type Props = {
  className?: string;
};

/**
 * Small decorative pill that sits next to roadmap perks signalling
 * future-tier delivery. Sourced from `PRO_COPY.comingSoonLabel` so
 * copy stays single-source. Spec: addendum §3.7 (C3) / §6.1 commit #5.
 */
export function ComingSoonChip({ className }: Props) {
  return (
    <span
      data-testid="coming-soon-chip"
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-nano font-bold uppercase tracking-wider${
        className ? ` ${className}` : ""
      }`}
      style={{
        backgroundColor: "rgba(110, 65, 15, 0.10)",
        color: "rgba(110, 65, 15, 0.65)",
      }}
    >
      {PRO_COPY.comingSoonLabel}
    </span>
  );
}
