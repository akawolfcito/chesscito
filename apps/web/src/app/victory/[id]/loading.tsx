export default function VictoryLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
        <p className="text-sm font-medium text-cyan-100/50">Loading victory...</p>
      </div>
    </div>
  );
}
