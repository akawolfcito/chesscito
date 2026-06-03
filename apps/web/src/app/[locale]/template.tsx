import { BuildVersionGate } from "@/components/dev/build-version-gate";

export default function Template({ children }: { children: React.ReactNode }) {
  // Hide the build pill on production deploys. It's a client component
  // that paints post-hydration, which anchored the LCP candidate late
  // on /hub (Render Delay ~5.7s in PSI mobile). Local + preview keep
  // the pill so smoke-testers can still confirm the running bundle.
  // See docs/audits/2026-06-03-hub-render-delay-audit.md.
  const showBuildPill = process.env.VERCEL_ENV !== "production";

  return (
    <div className="animate-in fade-in duration-200">
      {children}
      {showBuildPill && (
        /* Tiny build chip — bottom-right, low opacity, zero layout impact.
           Visible only on `/hub` + `/dev/*` (see BuildVersionGate). On
           gameplay/content routes the pill obstructed the menu area in
           MiniPay sessions, so it was scoped down to the home surface
           where smoke-testers actually need it. */
        <div
          className="pointer-events-none fixed bottom-1 right-1 z-[100] select-none"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <BuildVersionGate />
        </div>
      )}
    </div>
  );
}
