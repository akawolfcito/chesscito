export default function VictoryLoading() {
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,250,235,1) 0%, rgba(250,240,210,1) 55%, rgba(240,225,185,1) 100%)",
      }}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2"
          style={{
            borderColor: "rgba(110, 65, 15, 0.25)",
            borderTopColor: "rgba(110, 65, 15, 0.85)",
          }}
        />
        <p
          className="text-sm font-semibold"
          style={{
            color: "rgba(110, 65, 15, 0.75)",
            textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
          }}
        >
          Loading victory...
        </p>
      </div>
    </div>
  );
}
