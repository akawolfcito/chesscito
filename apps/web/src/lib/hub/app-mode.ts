export type ChesscitoAppMode = "training" | "play";

const MODE_HOSTS: Record<ChesscitoAppMode, Record<"preview" | "production", string>> = {
  training: {
    preview: "lite-preview.chesscito.com",
    production: "lite.chesscito.com",
  },
  play: {
    preview: "preview.chesscito.com",
    production: "play.chesscito.com",
  },
};

function deploymentFor(hostname: string): "preview" | "production" {
  return hostname === MODE_HOSTS.training.preview || hostname === MODE_HOSTS.play.preview
    ? "preview"
    : "production";
}

function hubPathFor(mode: ChesscitoAppMode, pathname: string): string {
  const locale = pathname.match(/^\/(en|es)(?:\/|$)/)?.[1];
  const prefix = locale ? `/${locale}` : "";
  return mode === "play" ? `${prefix}/hub` : prefix || "/";
}

/** Crosses between each deployment's canonical Hub while retaining locale and URL state. */
export function appModeUrl(mode: ChesscitoAppMode, currentUrl: URL): string {
  const target = new URL(currentUrl.toString());
  target.hostname = MODE_HOSTS[mode][deploymentFor(currentUrl.hostname)];
  target.protocol = "https:";
  target.port = "";
  target.pathname = hubPathFor(mode, currentUrl.pathname);
  return target.toString();
}
