export type ProOriginClassification =
  | {
      status: "allowed";
      currentHost: string;
      allowedHosts: string[];
    }
  | {
      status: "mismatch";
      currentHost: string;
      allowedHosts: string[];
    }
  | {
      status: "unconfigured";
      currentHost: string;
      allowedHosts: [];
    }
  | {
      status: "invalid-source";
      currentHost: null;
      allowedHosts: string[];
    };

/**
 * Reproduces the existing `enforceOrigin` allowlist transformation exactly.
 * Config values are hosts or absolute URLs; only a leading http(s) protocol
 * is removed. Ports remain part of the acceptance key.
 */
export function configuredProOriginHost(
  value: string | null | undefined,
): string | null {
  // Deliberately do not trim: this mirrors the pre-existing server
  // `envVar.replace(...)` behavior byte-for-byte. A whitespace typo must be
  // diagnosed as a mismatch rather than accepted only by the client warning.
  return value ? value.replace(/^https?:\/\//, "") : null;
}

/**
 * The single acceptance classifier for `/api/pro/status` and its DEV warning.
 * The request source is parsed as a URL and compared by `URL.host`, matching
 * the server's current boundary: hostname + port, excluding protocol.
 */
export function classifyProOriginHost(
  source: string,
  configuredValues: ReadonlyArray<string | null | undefined>,
): ProOriginClassification {
  const allowedHosts = Array.from(
    new Set(
      configuredValues
        .map(configuredProOriginHost)
        .filter((host): host is string => host !== null),
    ),
  );

  let currentHost: string;
  try {
    currentHost = new URL(source).host;
  } catch {
    return { status: "invalid-source", currentHost: null, allowedHosts };
  }

  if (allowedHosts.length === 0) {
    return { status: "unconfigured", currentHost, allowedHosts: [] };
  }

  return allowedHosts.includes(currentHost)
    ? { status: "allowed", currentHost, allowedHosts }
    : { status: "mismatch", currentHost, allowedHosts };
}

export function publicProOriginConfiguration(): Array<string | undefined> {
  return [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_PREVIEW_URL,
  ];
}
