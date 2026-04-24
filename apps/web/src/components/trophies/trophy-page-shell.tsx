import Link from "next/link";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { CandyIcon } from "@/components/redesign/candy-icon";

type TrophyPageShellProps = {
  title: string;
  /** Optional one-line description under the title. */
  subtitle?: string;
  backHref?: string;
  children: React.ReactNode;
};

/**
 * TrophyPageShell — destination-first frame for the /trophies route.
 *
 * Legal pages (terms, privacy, support, about) share LegalPageShell
 * because they're paperwork. Trophies is *glory*, not paperwork — so
 * it gets its own frame with a warm amber trophy hero and an amber
 * accent bar under the header. Keeps the candy-page-panel body for
 * text readability (stats, lists) while signaling "this is the
 * trophy room, not another legal page".
 */
export function TrophyPageShell({
  title,
  subtitle,
  backHref = "/",
  children,
}: TrophyPageShellProps) {
  return (
    <div className="mission-shell secondary-page-scrim flex min-h-[100dvh] justify-center">
      <div
        className="candy-page-panel trophy-page-panel flex w-full max-w-[var(--app-max-width)] flex-col rounded-t-3xl"
        style={{ background: "var(--paper-bg)" }}
      >
        <header
          className="relative flex items-center gap-3 border-b px-5 py-5 rounded-t-3xl"
          style={{ borderColor: "var(--paper-divider)" }}
        >
          {/* Amber accent bar — signals "glory surface" at a glance
              and visually links to the trophy dock icon. */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[3px] rounded-t-3xl"
            style={{
              background:
                "linear-gradient(90deg, rgba(245, 158, 11, 0) 0%, rgba(245, 158, 11, 0.75) 50%, rgba(245, 158, 11, 0) 100%)",
            }}
          />

          <Link
            href={backHref}
            className="flex h-11 w-11 items-center justify-center"
            aria-label="Go back"
          >
            <CandyBanner name="btn-back" className="h-8 w-8" />
          </Link>

          {/* Trophy hero — amber halo + candy trophy icon */}
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(245, 158, 11, 0.28) 0%, rgba(217, 180, 74, 0.12) 55%, transparent 80%)",
              }}
            />
            <CandyIcon name="trophy" className="relative h-9 w-9" />
          </div>

          <div className="min-w-0 flex-1">
            <h1
              className="fantasy-title truncate text-xl font-bold"
              style={{ color: "var(--paper-text)" }}
            >
              {title}
            </h1>
            {subtitle ? (
              <p
                className="truncate text-xs"
                style={{ color: "var(--paper-text-muted)" }}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
        </header>
        <div
          className="flex-1 space-y-6 px-5 pb-8 pt-6 text-sm leading-relaxed"
          style={{ color: "var(--paper-text)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
