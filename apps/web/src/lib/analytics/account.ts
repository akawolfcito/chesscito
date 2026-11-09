/**
 * The connected address, held for telemetry.
 *
 * `track()` is a plain function called from ~120 sites, most of them nowhere
 * near a wallet hook, so threading the address through every signature would be
 * a large and permanent tax. Instead the wallet layer publishes the current
 * address here whenever it changes and `track()` reads it.
 *
 * The address is sent to our own `/api/telemetry`, which immediately turns it
 * into a keyed pseudonym (see `account-ref.ts`) and stores only that. It is
 * never written to storage on the client and never attached to `props`.
 *
 * Module-level state is deliberate: it must survive component unmounts within a
 * visit, and there is exactly one connected wallet per tab.
 */

let currentAccount: string | null = null;

/** Publish (or clear, on disconnect) the connected address. */
export function setTelemetryAccount(address: string | null | undefined): void {
  currentAccount = typeof address === "string" && address ? address : null;
}

/** The address to attach to the next event, or null when signed out. */
export function getTelemetryAccount(): string | null {
  return currentAccount;
}
