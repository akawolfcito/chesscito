'use client'

const CONFETTI_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#facc15', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
] as const

/* Deterministic radial-burst confetti specs — 24 chips with angles
   spaced every 15° around a full circle so the explosion reads as a
   true radial burst. Each piece has a precomputed (burstX, burstY)
   target on a ring of radius 90–140px (six varied radii for organic
   feel). Hardcoded so the spread is designed, not random — and avoids
   hydration mismatches. Y positive = down (CSS convention), so chips
   with positive burstY shoot below the anchor; negative ones shoot up
   then are pulled back by gravity in the fall phase. */
const CONFETTI: Array<{
  burstX: string
  burstY: string
  driftX: string // extra horizontal drift during fall
  spin: string // total rotation across the animation
  size: string
  color: number
  delay: string
  duration: string
}> = [
  { burstX: '90px',   burstY: '0px',    driftX: '20px',  spin: '720deg',  size: '10px', color: 0, delay: '0ms',   duration: '2400ms' },
  { burstX: '116px',  burstY: '-31px',  driftX: '24px',  spin: '-660deg', size: '8px',  color: 2, delay: '20ms',  duration: '2350ms' },
  { burstX: '87px',   burstY: '-50px',  driftX: '18px',  spin: '600deg',  size: '12px', color: 4, delay: '0ms',   duration: '2450ms' },
  { burstX: '92px',   burstY: '-92px',  driftX: '14px',  spin: '-540deg', size: '9px',  color: 7, delay: '40ms',  duration: '2400ms' },
  { burstX: '55px',   burstY: '-95px',  driftX: '10px',  spin: '720deg',  size: '11px', color: 1, delay: '10ms',  duration: '2350ms' },
  { burstX: '36px',   burstY: '-135px', driftX: '12px',  spin: '-720deg', size: '8px',  color: 3, delay: '30ms',  duration: '2500ms' },
  { burstX: '0px',    burstY: '-90px',  driftX: '0px',   spin: '540deg',  size: '12px', color: 5, delay: '0ms',   duration: '2400ms' },
  { burstX: '-31px',  burstY: '-116px', driftX: '-10px', spin: '-600deg', size: '10px', color: 8, delay: '20ms',  duration: '2350ms' },
  { burstX: '-50px',  burstY: '-87px',  driftX: '-14px', spin: '660deg',  size: '9px',  color: 0, delay: '40ms',  duration: '2450ms' },
  { burstX: '-92px',  burstY: '-92px',  driftX: '-12px', spin: '-720deg', size: '11px', color: 2, delay: '10ms',  duration: '2500ms' },
  { burstX: '-95px',  burstY: '-55px',  driftX: '-18px', spin: '540deg',  size: '8px',  color: 6, delay: '30ms',  duration: '2400ms' },
  { burstX: '-135px', burstY: '-36px',  driftX: '-22px', spin: '-540deg', size: '12px', color: 1, delay: '0ms',   duration: '2350ms' },
  { burstX: '-90px',  burstY: '0px',    driftX: '-26px', spin: '720deg',  size: '10px', color: 4, delay: '20ms',  duration: '2400ms' },
  { burstX: '-116px', burstY: '31px',   driftX: '-20px', spin: '-660deg', size: '9px',  color: 7, delay: '40ms',  duration: '2450ms' },
  { burstX: '-87px',  burstY: '50px',   driftX: '-12px', spin: '600deg',  size: '11px', color: 3, delay: '10ms',  duration: '2400ms' },
  { burstX: '-92px',  burstY: '92px',   driftX: '-16px', spin: '-540deg', size: '8px',  color: 5, delay: '30ms',  duration: '2350ms' },
  { burstX: '-55px',  burstY: '95px',   driftX: '-10px', spin: '720deg',  size: '10px', color: 8, delay: '0ms',   duration: '2400ms' },
  { burstX: '-36px',  burstY: '135px',  driftX: '-6px',  spin: '-720deg', size: '12px', color: 6, delay: '20ms',  duration: '2500ms' },
  { burstX: '0px',    burstY: '90px',   driftX: '0px',   spin: '540deg',  size: '9px',  color: 0, delay: '40ms',  duration: '2400ms' },
  { burstX: '31px',   burstY: '116px',  driftX: '10px',  spin: '-600deg', size: '11px', color: 2, delay: '10ms',  duration: '2350ms' },
  { burstX: '50px',   burstY: '87px',   driftX: '14px',  spin: '660deg',  size: '8px',  color: 4, delay: '30ms',  duration: '2450ms' },
  { burstX: '92px',   burstY: '92px',   driftX: '18px',  spin: '-540deg', size: '12px', color: 7, delay: '0ms',   duration: '2400ms' },
  { burstX: '95px',   burstY: '55px',   driftX: '22px',  spin: '720deg',  size: '10px', color: 1, delay: '20ms',  duration: '2350ms' },
  { burstX: '135px',  burstY: '36px',   driftX: '28px',  spin: '-540deg', size: '9px',  color: 3, delay: '40ms',  duration: '2500ms' },
]

/* Radial confetti burst — the chips emanate from the CENTER of the
   nearest positioned ancestor, so mount it inside the element the
   celebration should explode from (the avatar, the shield, the panel).
   That ancestor must NOT set `overflow: hidden` or chips are clipped
   mid-flight. Shared by the exercise-success panel and the Season Pass
   celebration; the `confetti-burst-fall` keyframe lives in globals.css. */
export function ConfettiBurst() {
  return (
    <div
      aria-hidden="true"
      data-testid="confetti-burst"
      className="pointer-events-none absolute inset-0"
    >
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 rounded-[2px]"
          style={{
            width: c.size,
            height: c.size,
            background: CONFETTI_COLORS[c.color],
            ['--burst-x' as string]: c.burstX,
            ['--burst-y' as string]: c.burstY,
            ['--drift-x' as string]: c.driftX,
            ['--spin' as string]: c.spin,
            animation: `confetti-burst-fall ${c.duration} cubic-bezier(0.22, 0.61, 0.36, 1) ${c.delay} both`,
            boxShadow: '0 1px 2px rgba(63, 34, 8, 0.35)',
          }}
        />
      ))}
    </div>
  )
}

/* Top-of-screen celebration — a fixed, viewport-anchored host that rains
   the same ConfettiBurst from near the top edge. Mounted right after an
   on-chain transaction is CONFIRMED (badge claim, score save, shop buy),
   so the burst reads as "your transaction landed". Pointer-events off and
   aria-hidden so it never intercepts taps or reaches the a11y tree. */
export function TopScreenConfetti() {
  return (
    <div className="tx-celebration-top" aria-hidden="true" data-testid="tx-celebration-top">
      <ConfettiBurst />
    </div>
  )
}
