'use client'

/**
 * CandyModalFrame — Sprint 6 commit B (2026-06-08).
 *
 * Tiny composable shell for candy-aligned overlays that DON'T already
 * live inside CandyGlassShell (the existing canonical shell for arena
 * modals + dock sheets). This primitive is intentionally smaller: it
 * does NOT paint the sheet-bg-hub forest backdrop, does NOT host a
 * close button, does NOT manage CTA / meta footers via dedicated
 * props. It is a frame, not a full modal kit.
 *
 * The contract is presentation-only:
 *   - tone        : amber / sky / neutral / warning palette selector
 *   - iconSlot    : optional sprite anchored top-center
 *   - title       : optional bold headline string
 *   - subtitle    : optional muted single-line string
 *   - children    : free-form body
 *   - footerSlot  : optional footer area (CTAs, hints, dots)
 *   - className   : passthrough for layout tuning at the call site
 *
 * The frame stays out of business logic:
 *   - No fetch, no telemetry, no Coach / Peones / payment / nav
 *   - No state, no refs, no effects
 *   - All slots are passthrough nodes; rendering is React-pure
 *
 * Designed so polish slices (Coach loading, Luz onboarding, etc.) can
 * adopt one frame primitive without inheriting a design system. If
 * we discover a surface needs MORE (close button, scrim, focus trap),
 * that surface composes its own wrapper around this frame rather than
 * pulling the feature into the primitive.
 */

import type { ReactNode } from 'react'

export type CandyModalFrameTone =
  | 'amber' // hint / warm CTA / earn surfaces
  | 'sky' // coach / cool / informational
  | 'neutral' // generic / first-impression
  | 'warning' // failure / error feedback

type Props = {
  tone?: CandyModalFrameTone
  iconSlot?: ReactNode
  title?: string
  subtitle?: string
  children?: ReactNode
  footerSlot?: ReactNode
  className?: string
}

const TONE_CLASSES: Record<
  CandyModalFrameTone,
  { bg: string; ring: string; titleColor: string; subtitleColor: string }
> = {
  amber: {
    bg: 'bg-amber-50/95',
    ring: 'ring-amber-800/15',
    titleColor: 'text-amber-950',
    subtitleColor: 'text-amber-900/70',
  },
  sky: {
    bg: 'bg-sky-50/00',
    ring: 'ring-sky-800/00',
    titleColor: 'text-sky-950',
    subtitleColor: 'text-sky-900/70',
  },
  neutral: {
    bg: 'bg-white/35',
    ring: 'ring-amber-800/15',
    titleColor: 'text-amber-950',
    subtitleColor: 'text-amber-900/70',
  },
  warning: {
    bg: 'bg-rose-50/95',
    ring: 'ring-rose-800/15',
    titleColor: 'text-rose-950',
    subtitleColor: 'text-rose-900/70',
  },
}

export function CandyModalFrame({
  tone = 'neutral',
  iconSlot,
  title,
  subtitle,
  children,
  footerSlot,
  className,
}: Props) {
  const palette = TONE_CLASSES[tone]
  return (
    <div
      className={[
        'inline-flex w-full max-w-[20rem] flex-col items-center gap-3 rounded-3xl px-5 py-5 text-center shadow-lg ring-1',
        palette.bg,
        palette.ring,
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="candy-modal-frame"
      data-tone={tone}
    >
      {iconSlot ? (
        <div
          className="flex items-center justify-center"
          data-testid="candy-modal-frame-icon"
        >
          {iconSlot}
        </div>
      ) : null}
      {title ? (
        <h2
          className={`text-base font-bold leading-tight ${palette.titleColor}`}
          data-testid="candy-modal-frame-title"
        >
          {title}
        </h2>
      ) : null}
      {subtitle ? (
        <p
          className={`text-sm leading-snug ${palette.subtitleColor}`}
          data-testid="candy-modal-frame-subtitle"
        >
          {subtitle}
        </p>
      ) : null}
      {children ? (
        <div
          className="flex w-full flex-col items-center gap-2"
          data-testid="candy-modal-frame-body"
        >
          {children}
        </div>
      ) : null}
      {footerSlot ? (
        <div
          className="mt-1 flex w-full flex-col items-center gap-2"
          data-testid="candy-modal-frame-footer"
        >
          {footerSlot}
        </div>
      ) : null}
    </div>
  )
}
