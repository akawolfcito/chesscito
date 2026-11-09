/** New PRO sales are paused. Existing entitlement reads remain available.
 * Reopening sales requires an explicit code review and payment preparation. */
export function isProSalesEnabled(): boolean {
  return false;
}
