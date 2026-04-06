import Link from "next/link";
import { LegalPageShell } from "@/components/legal-page-shell";
import { ABOUT_COPY } from "@/lib/content/editorial";
import { LifeBuoy, Shield, FileText } from "lucide-react";
import { InviteLink } from "./invite-link";

export const metadata = {
  title: "About — Chesscito",
  description: "About Chesscito — operator, support, and legal information.",
};

const ABOUT_LINKS = [
  { href: "/support", label: ABOUT_COPY.links.support, icon: LifeBuoy },
  { href: "/privacy", label: ABOUT_COPY.links.privacy, icon: Shield },
  { href: "/terms", label: ABOUT_COPY.links.terms, icon: FileText },
] as const;

export default function AboutPage() {
  return (
    <LegalPageShell title="About" backHref="/">
      {/* Identity */}
      <div className="flex flex-col items-center gap-2 pb-2 text-center">
        <picture>
          <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
          <img
            src="/art/favicon-wolf.png"
            alt="Chesscito logo"
            className="h-16 w-16 drop-shadow-[0_0_24px_rgba(103,232,249,0.15)]"
          />
        </picture>
        <h2 className="text-xl font-bold text-cyan-50 drop-shadow-[0_0_8px_rgba(103,232,249,0.2)]">{ABOUT_COPY.title}</h2>
        <p className="text-xs text-cyan-300/60">{ABOUT_COPY.operatedBy}</p>
        <p className="text-xs text-cyan-300/40">{ABOUT_COPY.handle}</p>
        <p className="text-xs text-cyan-300/50">{ABOUT_COPY.version}</p>
      </div>

      {/* Links */}
      <nav className="space-y-2">
        {ABOUT_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-white/[0.10] bg-white/[0.06] px-4 py-3 text-cyan-100 transition hover:bg-white/[0.10]"
          >
            <Icon size={18} className="shrink-0 text-cyan-400" />
            <span className="text-sm font-medium">{label}</span>
          </Link>
        ))}

        {/* Invite / Share — duplicated from dock, not moved */}
        <InviteLink />
      </nav>
    </LegalPageShell>
  );
}
