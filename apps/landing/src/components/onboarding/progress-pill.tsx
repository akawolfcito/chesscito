export function ProgressPill({ current, total }: { current: number; total: number }) {
  return (
    <div className="rounded-full bg-[#1d2a6b] px-4 py-1.5 text-sm font-bold text-white">
      {current} / {total}
    </div>
  );
}
