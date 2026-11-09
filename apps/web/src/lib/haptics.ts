/** Thin wrapper around navigator.vibrate — silent no-op if unsupported. */
export function haptic(pattern: number | number[]) {
  try {
    navigator?.vibrate?.(pattern);
  } catch { /* unsupported — ignore */ }
}

/** Quick tap feedback (8ms) */
export const hapticTap = () => haptic(8);

/** Double pulse for rejection (4ms on, 30ms off, 4ms on) */
export const hapticReject = () => haptic([4, 30, 4]);

/** Rising pattern for success */
export const hapticSuccess = () => haptic([15, 50, 80]);

/** Single medium pulse for capture/checkmate */
export const hapticImpact = () => haptic(20);
