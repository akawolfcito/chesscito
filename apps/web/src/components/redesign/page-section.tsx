import type { ReactNode } from "react";

type Props = {
  /** Optional icon rendered before the title (e.g. CandyIcon). */
  icon?: ReactNode;
  /** Section heading — rendered as uppercase warm-brown small caps. */
  title: string;
  /** Optional one-line description under the heading. */
  description?: string;
  /** Extra classes on the <section>. */
  className?: string;
  children: ReactNode;
};

/**
 * PageSection — canonical warm-brown section scaffold for secondary
 * pages (trophies, about, support, etc.). One heading style across
 * every section: uppercase small-caps, `rgba(110, 65, 15, 0.75)` with
 * a cream text-shadow — no more gold/amber/violet drift per page.
 */
export function PageSection({ icon, title, description, className = "", children }: Props) {
  return (
    <section className={`mb-6 ${className}`.trim()}>
      <h2
        className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"
        style={{
          color: "rgba(110, 65, 15, 0.80)",
          textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
        }}
      >
        {icon}
        {title}
      </h2>
      {description ? (
        <p
          className="mb-3 text-[11px]"
          style={{ color: "rgba(110, 65, 15, 0.65)" }}
        >
          {description}
        </p>
      ) : (
        <div className="mb-3" />
      )}
      {children}
    </section>
  );
}
