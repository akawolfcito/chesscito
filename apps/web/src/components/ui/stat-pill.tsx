type Props = {
  label: string;
  variant?: "cyan" | "amber";
};

export function StatPill({ label, variant = "cyan" }: Props) {
  const borderClass =
    variant === "amber" ? "border-amber-400/30" : "border-cyan-400/30";

  return (
    <span
      className={`rounded-full border ${borderClass} bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur-sm`}
    >
      {label}
    </span>
  );
}
