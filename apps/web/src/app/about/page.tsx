import Link from "next/link";
import { LegalPageShell } from "@/components/legal-page-shell";
import { AboutMethodology } from "@/components/about/about-methodology";
import { CognitiveDisclaimer } from "@/components/legal/cognitive-disclaimer";
import { ABOUT_COPY } from "@/lib/content/editorial";
import { Compass, FileText, LifeBuoy, Shield } from "lucide-react";
import { InviteLink } from "./invite-link";

export const metadata = {
  title: "About — Chesscito",
  description: "About Chesscito — operator, support, and legal information.",
};

const ABOUT_LINKS = [
  { href: "/", label: ABOUT_COPY.links.why, icon: Compass },
  { href: "/support", label: ABOUT_COPY.links.support, icon: LifeBuoy },
  { href: "/privacy", label: ABOUT_COPY.links.privacy, icon: Shield },
  { href: "/terms", label: ABOUT_COPY.links.terms, icon: FileText },
] as const;

export default function AboutPage() {
  return (
    <LegalPageShell title="About" backHref="/hub">
      {/* Identity */}
      <div className="flex flex-col items-center gap-2 pb-2 text-center">
        <picture>
          <source srcSet="/art/favicon-wolf.avif" type="image/avif" />
          <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
          <img
            src="/art/favicon-wolf.png"
            alt="Chesscito logo"
            className="h-16 w-16 drop-shadow-[0_0_24px_rgba(245,158,11,0.35)]"
          />
        </picture>
        <h2
          className="fantasy-title text-xl font-bold"
          style={{
            color: "var(--paper-text)",
            textShadow: "0 1px 0 rgba(255, 235, 180, 0.7)",
          }}
        >
          {ABOUT_COPY.title}
        </h2>
        <p className="text-xs" style={{ color: "var(--paper-text-muted)" }}>{ABOUT_COPY.operatedBy}</p>
        <p className="text-xs" style={{ color: "var(--paper-text-subtle)" }}>{ABOUT_COPY.handle}</p>
        <p className="text-xs" style={{ color: "var(--paper-text-subtle)" }}>{ABOUT_COPY.version}</p>
      </div>

      {/* Methodology mini-section (Phase 0.5 C2) — credits the human
          team behind the curriculum. Sits between identity and links
          so the differentiator (FIDE Master pedagogy + dev team) is
          read right after "what is Chesscito". */}
      <AboutMethodology />

      {/* Links */}
      <nav className="space-y-2">
        {ABOUT_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="paper-tray flex min-h-[44px] items-center gap-3 transition active:scale-[0.99]"
            style={{ color: "var(--paper-text)" }}
          >
            <Icon size={18} className="shrink-0" style={{ color: "rgba(180, 110, 20, 0.95)" }} />
            <span className="text-sm font-semibold">{label}</span>
          </Link>
        ))}

        {/* Invite / Share — primary surface after dock slot was reclaimed for Trophies. */}
        <InviteLink />
      </nav>

      {/* Cognitive disclaimer (Phase 0.5 C2) — full variant lives here
          and on landing only. Per the canon decision (2026-05-03),
          in-app surfaces (play-hub, arena) do NOT carry the
          disclaimer; readers who want context land on /about. */}
      <CognitiveDisclaimer variant="full" className="pt-4" />
    </LegalPageShell>
  );
}
