import type { ChesscitoMode } from "@/lib/feature-flags";

type Deployment = "preview" | "production";

const MODE_HOSTS: Record<"learn" | "play", Record<Deployment, string>> = {
  learn: {
    preview: "learn-preview.chesscito.com",
    production: "learn.chesscito.com",
  },
  play: {
    preview: "preview.chesscito.com",
    production: "play.chesscito.com",
  },
};

const LEGACY_LITE_HOSTS = new Set([
  "lite.chesscito.com",
  "lite-preview.chesscito.com",
]);

/**
 * The origin a PLAY-only surface must be linked at from `current`.
 *
 * ⚠️ Exported so the duel's share link can be built without a second copy of
 * `MODE_HOSTS`. Two host tables that drift is the same failure mode as two
 * copies of the board geometry: nothing observable breaks until the day one of
 * them is wrong.
 *
 * A host we do not recognise — localhost, a preview tunnel — keeps its own
 * origin. That is deliberate: rewriting a `trycloudflare.com` tunnel to
 * `play.chesscito.com` would hand a tester a link to PRODUCTION every time they
 * tried a duel on their phone. There is no cross-domain bounce in dev anyway.
 */
export function playOriginFrom(current: URL): string {
  const isKnownLearnHost =
    current.hostname === MODE_HOSTS.learn.production ||
    current.hostname === MODE_HOSTS.learn.preview;
  if (!isKnownLearnHost) return current.origin;

  return `https://${MODE_HOSTS.play[deploymentFor(current.hostname)]}`;
}

function stripLocalePrefix(
  pathname: string,
  locales: readonly string[],
): string {
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(`/${locale}`.length) || "/";
    }
  }
  return pathname;
}

function beginsWithSegment(pathname: string, segment: string): boolean {
  return pathname === `/${segment}` || pathname.startsWith(`/${segment}/`);
}

function deploymentFor(hostname: string): Deployment {
  return hostname === MODE_HOSTS.learn.preview ||
    hostname === MODE_HOSTS.play.preview ||
    hostname === "lite-preview.chesscito.com"
    ? "preview"
    : "production";
}

function destinationModeForPath(
  mode: ChesscitoMode,
  pathname: string,
  locales: readonly string[],
): "learn" | "play" | null {
  const canonical = stripLocalePrefix(pathname, locales);

  if (
    mode === "learn" &&
    (beginsWithSegment(canonical, "arena") ||
      beginsWithSegment(canonical, "coach"))
  ) {
    return "play";
  }

  if (mode === "play" && beginsWithSegment(canonical, "exercises")) {
    return "learn";
  }

  return null;
}

/**
 * Returns the cross-product destination for a route restricted by deployment
 * mode. The deployment mode is authoritative; hostnames only select the
 * production/preview counterpart and exempt the two legacy Lite deployments.
 */
export function modeRedirectUrl(
  mode: ChesscitoMode,
  currentUrl: URL,
  locales: readonly string[],
): URL | null {
  if (mode === "full" || LEGACY_LITE_HOSTS.has(currentUrl.hostname)) {
    return null;
  }

  const destinationMode = destinationModeForPath(
    mode,
    currentUrl.pathname,
    locales,
  );
  if (!destinationMode) return null;

  const target = new URL(currentUrl.toString());
  target.protocol = "https:";
  target.port = "";
  target.hostname = MODE_HOSTS[destinationMode][deploymentFor(currentUrl.hostname)];

  // A misconfigured deployment must not redirect back to itself forever.
  return target.hostname === currentUrl.hostname ? null : target;
}
