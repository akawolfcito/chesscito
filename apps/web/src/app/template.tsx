import { BuildVersion } from "@/components/dev/build-version";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in duration-200">
      {children}
      {/* Tiny build chip — bottom-right, low opacity, zero layout impact.
          Lets the smoke-tester verify "the new code is loaded" at a
          glance after every deploy. */}
      <div
        className="pointer-events-none fixed bottom-1 right-1 z-[100] select-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <BuildVersion />
      </div>
    </div>
  );
}
