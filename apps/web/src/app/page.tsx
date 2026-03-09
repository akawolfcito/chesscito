import { AppShell } from "@/components/app-shell";
import { CTA_LABELS, GLOSSARY } from "@/lib/content/editorial";

export default function Home() {
  return (
    <div className="intro-shell">
      <AppShell
        eyebrow="MiniPay MiniApp"
        title="Chesscito"
        description="Learn each piece through quick mobile trials. Build progress, claim badges, and submit your score on Celo."
        cta={{ href: "/play-hub", label: CTA_LABELS.startTrial }}
        secondaryCta={{ href: "/leaderboard", label: CTA_LABELS.viewLeaderboard }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-950 px-4 py-4 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">{GLOSSARY.trial}</p>
            <p className="mt-2 text-sm leading-6 text-white/90">Start a fast piece challenge and learn the pattern in a few moves.</p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{GLOSSARY.progress}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">Complete each piece path to unlock your next badge and keep moving forward.</p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Proof</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">Claim your badge and submit your score with a mobile-first flow built for MiniPay.</p>
          </div>
        </div>
      </AppShell>
    </div>
  );
}
