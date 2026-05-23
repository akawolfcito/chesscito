import { BuildVersionGate } from "@/components/dev/build-version-gate";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in duration-200">
      {children}
      {/* Tiny build chip — bottom-right, low opacity, zero layout impact.
          Visible only on `/hub` + `/dev/*` (see BuildVersionGate). On
          gameplay/content routes the pill obstructed the menu area in
          MiniPay sessions, so it was scoped down to the home surface
          where smoke-testers actually need it. */}
      <div
        className="pointer-events-none fixed bottom-1 right-1 z-[100] select-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <BuildVersionGate />
      </div>
    </div>
  );
}
