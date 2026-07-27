import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent } from '@testing-library/react'
import { renderWithIntl as render, screen } from '@/test-utils/render-with-intl'

import { ChallengeCard } from '../challenge-card'
import type { ChallengeCardProps } from '../challenge-card'

// Same guardrail the FocusPassport leaf enforces: no web3 / medical claims.
const FORBIDDEN =
  /verified|on-?chain|\bNFT\b|\bmint\b|proof|brain health|cure|improves (focus|memory)/i

const CHALLENGE: ChallengeCardProps['challenge'] = {
  durationDays: 21,
  shieldBonus: 3,
  priceLabel: '$1.99',
}

function passport(
  over: Partial<ChallengeCardProps['focusPassport']> = {},
): ChallengeCardProps['focusPassport'] {
  return {
    streak: 0,
    totalCompleted: 0,
    todayDone: false,
    isLoading: false,
    ...over,
  }
}

function focusDays(): number {
  return Number(
    screen.getByTestId('challenge-progress').getAttribute('data-done'),
  )
}

afterEach(() => {
  cleanup()
})

describe('<ChallengeCard>', () => {
  it('shows the Focus Passport `?` and replays the tour on tap, without a Join dependency', () => {
    const onReplayTour = vi.fn()
    render(
      <ChallengeCard
        focusPassport={passport()}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
        onReplayTour={onReplayTour}
      />,
    )
    expect(
      screen
        .getByTestId('challenge-replay-tour')
        .querySelector('[data-theme-slot="shared.tour-help"]'),
    ).not.toBeNull()
    fireEvent.click(screen.getByTestId('challenge-replay-tour'))
    expect(onReplayTour).toHaveBeenCalledTimes(1)
  })

  it('omits the `?` when no replay handler is wired', () => {
    render(
      <ChallengeCard
        focusPassport={passport()}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
      />,
    )
    expect(screen.queryByTestId('challenge-replay-tour')).toBeNull()
  })

  it('pulses the Join CTA while the purchase is available', () => {
    // The transaction this whole surface exists for. Once the hub tour ends,
    // the pulse is the only thing still pointing at it.
    render(
      <ChallengeCard
        focusPassport={passport()}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
      />,
    )
    expect(screen.getByTestId('challenge-cta').className).toContain(
      'is-pulsing',
    )
  })

  it('renders the tour Join nudge arrow alongside the button, and drops it when the pass is active', () => {
    // The arrow lives in the DOM whenever Join does; CSS reveals it only while
    // the mini-tour spotlights this card (see the hub-tour spotlight test).
    const { rerender } = render(
      <ChallengeCard
        focusPassport={passport()}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
      />,
    )
    // Offer state: Join exists → arrow is rendered next to it.
    expect(document.querySelector('.challenge-card-join-arrow')).toBeInTheDocument()

    // Active pass: no Join button, so no arrow.
    rerender(
      <ChallengeCard
        focusPassport={passport()}
        challenge={CHALLENGE}
        seasonPass={{ active: true, source: 'season_pass', dayOfChallenge: 3, shieldsCredited: 3 }}
        onJoinChallenge={null}
      />,
    )
    // One CTA always exists; what must disappear is the JOIN state.
    expect(screen.getByTestId('challenge-cta')).not.toHaveAttribute(
      'data-cta-state',
      'join',
    )
    expect(document.querySelector('.challenge-card-join-arrow')).toBeNull()
  })

  it('never pulses a CTA that cannot be tapped', () => {
    // `null` = status still resolving. A throbbing disabled button advertises a
    // dead control.
    render(
      <ChallengeCard
        focusPassport={passport()}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: true }}
        onJoinChallenge={null}
      />,
    )
    expect(screen.getByTestId('challenge-cta').className).not.toContain(
      'is-pulsing',
    )
  })

  it('loading: empty progress, stable structure (stats + CTA), aria-busy', () => {
    render(
      <ChallengeCard
        focusPassport={passport({ streak: 5, isLoading: true })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: true }}
        onJoinChallenge={() => {}}
      />,
    )
    expect(focusDays()).toBe(0)
    // Stable structure: stats + CTA render during loading too (no height flash).
    expect(screen.getByTestId('challenge-stats')).toBeInTheDocument()
    expect(screen.getByTestId('challenge-cta')).toBeInTheDocument()
    expect(screen.getByTestId('challenge-card')).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })

  it('offer (not joined): inline stats + Join CTA, progress = streak', () => {
    const onJoin = vi.fn()
    render(
      <ChallengeCard
        focusPassport={passport({ streak: 3, todayDone: true })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={onJoin}
      />,
    )
    expect(focusDays()).toBe(3)
    const card = screen.getByTestId('challenge-card')
    expect(card.textContent).toMatch(/Day 3 of 21/i)
    expect(card.textContent).toMatch(/\+3/)
    expect(card.textContent).toMatch(/\$1\.99/)
    expect(card.textContent).toMatch(/21-Day Mind Challenge/i)
    const cta = screen.getByTestId('challenge-cta')
    expect(cta).toHaveClass(
      'principal-button-medium',
      'hub-lite-start-focus',
      'challenge-card-cta',
    )
    fireEvent.click(cta)
    expect(onJoin).toHaveBeenCalledTimes(1)
    // No active-only affordances in the offer state.
    expect(screen.queryByTestId('challenge-active-badge')).toBeNull()
  })

  it('pending flame block opens Daily through its dedicated callback, never the Exercises CTA callback', () => {
    const onPassportTap = vi.fn()
    const onFocusTap = vi.fn()
    render(
      <ChallengeCard
        focusPassport={passport({ streak: 3, todayDone: false })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
        onFocusTap={onFocusTap}
        onPassportTap={onPassportTap}
      />,
    )
    const block = screen.getByTestId('challenge-progress')
    expect(block.tagName).toBe('BUTTON')
    fireEvent.click(block)
    expect(onPassportTap).toHaveBeenCalledTimes(1)
    expect(onFocusTap).not.toHaveBeenCalled()
  })

  it('keeps a hydrated pending Daily tappable while Season Pass status loads', () => {
    const onPassportTap = vi.fn()
    render(
      <ChallengeCard
        focusPassport={passport({ streak: 3, todayDone: false, isLoading: false })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: true }}
        onJoinChallenge={null}
        onPassportTap={onPassportTap}
      />,
    )

    const block = screen.getByTestId('challenge-progress')
    expect(block.tagName).toBe('BUTTON')
    fireEvent.click(block)
    expect(onPassportTap).toHaveBeenCalledTimes(1)
  })

  it('flame block is static while loading, completed, or missing its Daily callback', () => {
    const { rerender } = render(
      <ChallengeCard
        focusPassport={passport({ streak: 1 })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
      />,
    )
    expect(screen.getByTestId('challenge-progress').tagName).toBe('DIV')

    rerender(
      <ChallengeCard
        focusPassport={passport({ streak: 1, isLoading: true })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
        onPassportTap={() => {}}
      />,
    )
    expect(screen.getByTestId('challenge-progress').tagName).toBe('DIV')

    rerender(
      <ChallengeCard
        focusPassport={passport({ streak: 1, todayDone: true })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
        onPassportTap={() => {}}
      />,
    )
    expect(screen.getByTestId('challenge-progress').tagName).toBe('DIV')
  })

  it('offer with a long streak caps progress at durationDays (21)', () => {
    render(
      <ChallengeCard
        focusPassport={passport({ streak: 40, todayDone: true })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
      />,
    )
    expect(focusDays()).toBe(21)
  })

  it('active (joined): ACTIVE badge, live shields benefit, no Join CTA', () => {
    render(
      <ChallengeCard
        focusPassport={passport({ streak: 1, todayDone: true })}
        challenge={CHALLENGE}
        seasonPass={{
          active: true,
          source: 'season_pass',
          dayOfChallenge: 1,
          shieldsCredited: 3,
        }}
        onJoinChallenge={null}
        shields={{ count: 2, max: 3 }}
      />,
    )
    expect(screen.getByTestId('challenge-active-badge')).toBeInTheDocument()
    const card = screen.getByTestId('challenge-card')
    expect(screen.getByTestId('challenge-shields')).toHaveTextContent('2/3 Shields')
    expect(card.textContent).not.toMatch(/\+3/)
    expect(card.textContent).toMatch(/Special Training/)
    expect(card.textContent).toMatch(/Mind Challenge/i)
    // One CTA always exists; what must disappear is the JOIN state.
    expect(screen.getByTestId('challenge-cta')).not.toHaveAttribute(
      'data-cta-state',
      'join',
    )
  })

  it('active PRO: shows included coverage without advertising the +3 Shields bonus', () => {
    render(
      <ChallengeCard
        focusPassport={passport({ streak: 2, todayDone: true })}
        challenge={CHALLENGE}
        seasonPass={{ active: true, source: 'pro' }}
        onJoinChallenge={null}
      />,
    )

    expect(screen.getByTestId('challenge-active-badge')).toHaveTextContent(
      'PRO Benefit included',
    )
    expect(screen.getByTestId('challenge-card')).not.toHaveTextContent('+3')
    expect(screen.getByTestId('challenge-card')).toHaveTextContent(
      'Special Training',
    )
    // One CTA always exists; what must disappear is the JOIN state.
    expect(screen.getByTestId('challenge-cta')).not.toHaveAttribute(
      'data-cta-state',
      'join',
    )
  })

  it('copy contains no forbidden web3 / medical terms', () => {
    const { container } = render(
      <ChallengeCard
        focusPassport={passport({ streak: 4 })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
      />,
    )
    expect(container.textContent ?? '').not.toMatch(FORBIDDEN)
  })

  // ── Single primary CTA (one per state) ────────────────────────────────────
  describe('primary CTA', () => {
    function cta() {
      return screen.getByTestId('challenge-cta')
    }

    it('offers JOIN CHALLENGE with the price when there is no pass and no PRO', () => {
      render(
        <ChallengeCard
          focusPassport={passport()}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
          onFocusTap={() => {}}
        />,
      )
      expect(cta()).toHaveAttribute('data-cta-state', 'join')
      expect(cta().textContent).toMatch(/Join Challenge/i)
      expect(cta().textContent).toMatch(/\$1\.99/)
    })

    it('shows the compact START FOCUS label with an active Season Pass and a pending daily', () => {
      const onFocusTap = vi.fn()
      render(
        <ChallengeCard
          focusPassport={passport({ streak: 3, todayDone: false })}
          challenge={CHALLENGE}
          seasonPass={{
            active: true,
            source: 'season_pass',
            dayOfChallenge: 4,
            shieldsCredited: 3,
          }}
          onJoinChallenge={null}
          onFocusTap={onFocusTap}
        />,
      )
      expect(cta()).toHaveAttribute('data-cta-state', 'start')
      expect(cta()).toHaveClass('challenge-card-cta')
      expect(cta()).toHaveTextContent(/^Start Focus$/)
      fireEvent.click(cta())
      expect(onFocusTap).toHaveBeenCalledTimes(1)
    })

    it('shows START FOCUS for PRO — PRO never sees Join', () => {
      render(
        <ChallengeCard
          focusPassport={passport({ streak: 2, todayDone: false })}
          challenge={CHALLENGE}
          seasonPass={{ active: true, source: 'pro' }}
          onJoinChallenge={null}
          onFocusTap={() => {}}
        />,
      )
      expect(cta()).toHaveAttribute('data-cta-state', 'start')
      expect(cta().textContent).not.toMatch(/Join Challenge/i)
      // One CTA always exists; what must disappear is the JOIN state.
    expect(screen.getByTestId('challenge-cta')).not.toHaveAttribute(
      'data-cta-state',
      'join',
    )
    })

    it('shows COME BACK TOMORROW once today is done, as information and not a block', () => {
      const onFocusTap = vi.fn()
      render(
        <ChallengeCard
          focusPassport={passport({ streak: 5, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{
            active: true,
            source: 'season_pass',
            dayOfChallenge: 5,
            shieldsCredited: 3,
          }}
          onJoinChallenge={null}
          onFocusTap={onFocusTap}
        />,
      )
      expect(cta()).toHaveAttribute('data-cta-state', 'tomorrow')
      expect(cta().textContent).toMatch(/Come Back Tomorrow/i)
      // Not a button: it claims nothing and grants nothing. Tapping it must not
      // re-enter the daily (a second entry is what would double-claim a reward).
      expect(cta().tagName).not.toBe('BUTTON')
      fireEvent.click(cta())
      expect(onFocusTap).not.toHaveBeenCalled()
      // The card still says training remains open.
      expect(screen.getByTestId('challenge-card').textContent).toMatch(
        /Training stays open/i,
      )
    })

    it('shows CHALLENGE COMPLETE once the streak reaches the full duration', () => {
      render(
        <ChallengeCard
          focusPassport={passport({ streak: 21, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{
            active: true,
            source: 'season_pass',
            dayOfChallenge: 21,
            shieldsCredited: 3,
          }}
          onJoinChallenge={null}
          onFocusTap={() => {}}
        />,
      )
      expect(cta()).toHaveAttribute('data-cta-state', 'complete')
      expect(cta().textContent).toMatch(/Challenge Complete/i)
    })

    it('renders exactly one primary CTA in every state', () => {
      const states: ChallengeCardProps['seasonPass'][] = [
        { active: false, isLoading: false },
        { active: false, isLoading: true },
        { active: true, source: 'pro' },
        {
          active: true,
          source: 'season_pass',
          dayOfChallenge: 2,
          shieldsCredited: 3,
        },
      ]
      for (const seasonPass of states) {
        const { unmount } = render(
          <ChallengeCard
            focusPassport={passport({ streak: 2 })}
            challenge={CHALLENGE}
            seasonPass={seasonPass}
            onJoinChallenge={seasonPass.active ? null : () => {}}
            onFocusTap={() => {}}
          />,
        )
        expect(screen.getAllByTestId('challenge-cta')).toHaveLength(1)
        unmount()
      }
    })

    it('wears the shared primary-button skin and shows the price as a floating badge', () => {
      render(
        <ChallengeCard
          focusPassport={passport()}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
        />,
      )
      expect(cta().className).toContain('principal-button')
      // The price is a badge ON the button (Save Victory pattern), not an
      // inline pill competing with the label for the same line.
      const badge = cta().querySelector('.challenge-card-cta-badge')
      expect(badge).not.toBeNull()
      expect(badge?.textContent).toBe('$1.99')
    })

    it('keeps the tour arrow on the same row as the CTA it points at', () => {
      const { container } = render(
        <ChallengeCard
          focusPassport={passport()}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
        />,
      )
      const row = container.querySelector('.challenge-card-cta-row')
      expect(row).not.toBeNull()
      expect(row?.contains(container.querySelector('.challenge-card-join-arrow'))).toBe(true)
      expect(row?.contains(cta())).toBe(true)
    })
  })

  // ── Weekly row ────────────────────────────────────────────────────────────
  describe('weekly row', () => {
    // 2026-07-22 is a UTC Wednesday.
    const WED = '2026-07-22'

    function weekStates(): string[] {
      return screen
        .getAllByTestId('challenge-week-day')
        .map((el) => el.getAttribute('data-state') ?? '')
    }

    it('renders 7 Monday-first day letters localized for EN', () => {
      render(
        <ChallengeCard
          focusPassport={passport()}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
          today={WED}
        />,
      )
      const letters = screen
        .getAllByTestId('challenge-week-day')
        .map((el) => el.textContent?.trim())
      expect(letters).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
    })

    it('renders the ES letters (L M X J V S D), also Monday-first', () => {
      render(
        <ChallengeCard
          focusPassport={passport()}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
          today={WED}
        />,
        { locale: 'es' },
      )
      const letters = screen
        .getAllByTestId('challenge-week-day')
        .map((el) => el.textContent?.trim())
      expect(letters).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D'])
    })

    it('marks the UTC day of today, not a local-time day', () => {
      render(
        <ChallengeCard
          focusPassport={passport({ streak: 3, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
          today={WED}
        />,
      )
      // Wednesday is index 2 in a Monday-first row.
      expect(weekStates()).toEqual([
        'completed',
        'completed',
        'today-done',
        'future',
        'future',
        'future',
        'future',
      ])
    })

    it('leaves today pending when the daily is not done yet', () => {
      render(
        <ChallengeCard
          focusPassport={passport({ streak: 2, todayDone: false })}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
          today={WED}
        />,
      )
      expect(weekStates()[2]).toBe('today-pending')
    })

    it('claims nothing while loading — 7 neutral slots, no completions', () => {
      render(
        <ChallengeCard
          focusPassport={passport({ streak: 6, todayDone: true, isLoading: true })}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: true }}
          onJoinChallenge={null}
          today={WED}
        />,
      )
      expect(weekStates()).toHaveLength(7)
      expect(weekStates().some((s) => s.startsWith('completed'))).toBe(false)
      expect(weekStates().some((s) => s === 'today-done')).toBe(false)
    })

    it('never renders a shield-protected day (not modelled in storage)', () => {
      render(
        <ChallengeCard
          focusPassport={passport({ streak: 3, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
          today={WED}
        />,
      )
      expect(weekStates().some((s) => s.includes('shield'))).toBe(false)
    })
  })

  // ── Compact stats ─────────────────────────────────────────────────────────
  describe('stats', () => {
    it('shows only the live shields balance for an active Season Pass', () => {
      render(
        <ChallengeCard
          focusPassport={passport({ streak: 4, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{
            active: true,
            source: 'season_pass',
            dayOfChallenge: 4,
            shieldsCredited: 3,
          }}
          onJoinChallenge={null}
          shields={{ count: 2, max: 3 }}
        />,
      )
      expect(screen.queryByTestId('challenge-day')).toBeNull()
      expect(screen.getByTestId('challenge-shields')).toHaveTextContent(
        '2/3 Shields',
      )
      expect(screen.getByTestId('challenge-stats')).not.toHaveTextContent('+3')
    })

    it('omits Day X / 21 for PRO — the challenge day is not modelled there', () => {
      render(
        <ChallengeCard
          focusPassport={passport({ streak: 4, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{ active: true, source: 'pro' }}
          onJoinChallenge={null}
          shields={{ count: 3, max: 3 }}
        />,
      )
      expect(screen.queryByTestId('challenge-day')).toBeNull()
      expect(screen.getByTestId('challenge-card').textContent).toMatch(
        /Day 4 of 21/i,
      )
    })

    it('shows only the +N purchase bonus in the offer state', () => {
      // "+3 shields" (what you will receive) next to "0/3" (what you hold) read
      // as two answers to the same question. Before the purchase, only the
      // bonus is meaningful.
      render(
        <ChallengeCard
          focusPassport={passport({ streak: 1 })}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
          shields={{ count: 0, max: 3 }}
        />,
      )
      expect(screen.getByTestId('challenge-shields')).toHaveTextContent(
        '+3 Shields',
      )
      expect(screen.getByTestId('challenge-stats')).not.toHaveTextContent(
        '0/3',
      )
    })

    it('omits an unavailable active balance instead of inventing one', () => {
      render(
        <ChallengeCard
          focusPassport={passport({ streak: 1 })}
          challenge={CHALLENGE}
          seasonPass={{ active: true, source: 'pro' }}
          onJoinChallenge={null}
        />,
      )
      expect(screen.queryByTestId('challenge-shields')).toBeNull()
    })

    it('uses the editable Calendar, Shield, and Training slots and keeps price out of stats', () => {
      const { container } = render(
        <ChallengeCard
          focusPassport={passport()}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
        />,
      )
      const stats = screen.getByTestId('challenge-stats')
      expect(stats).toHaveTextContent('21 days')
      expect(stats).toHaveTextContent('+3 Shields')
      expect(stats).toHaveTextContent('Special Training')
      expect(stats).not.toHaveTextContent('$1.99')
      expect(
        Array.from(container.querySelectorAll('[data-theme-slot]')).map(
          (node) => node.getAttribute('data-theme-slot'),
        ),
      ).toEqual(
        expect.arrayContaining([
          'hub.focus-passport-calendar',
          'shared.shield',
          'hub.training-icon',
        ]),
      )
    })

    it('puts "Day N of 21" above the flames, not after them', () => {
      const { container } = render(
        <ChallengeCard
          focusPassport={passport({ streak: 2, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
        />,
      )
      const all = Array.from(container.querySelectorAll('*'))
      const ordinal = all.indexOf(container.querySelector('.challenge-card-day-count')!)
      const week = all.indexOf(container.querySelector('.challenge-card-week')!)
      expect(ordinal).toBeGreaterThanOrEqual(0)
      expect(ordinal).toBeLessThan(week)
    })

    // ── Distribution (KingdomCard grammar) ────────────────────────────────
    // The panel reads top-down: icon + title + day line, then the week at FULL
    // width, then a divided benefits row. Nesting the week inside the narrow
    // column beside the 72px icon squeezed 7 flames into ~250px at 390px.
    it('lifts the weekly row out of the icon column so it spans the panel', () => {
      const { container } = render(
        <ChallengeCard
          focusPassport={passport({ streak: 2, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
        />,
      )
      const card = container.querySelector('.challenge-card')!
      const top = container.querySelector('.challenge-card-top')!
      const week = container.querySelector('.challenge-card-week')!
      expect(top.contains(week)).toBe(false)
      expect(
        container.querySelector('.challenge-card-passport')!.parentElement,
      ).toBe(card)
    })

    it('keeps the day line beside the icon, with the title it belongs to', () => {
      const { container } = render(
        <ChallengeCard
          focusPassport={passport({ streak: 2, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
        />,
      )
      const main = container.querySelector('.challenge-card-top-main')!
      expect(
        main.contains(container.querySelector('.challenge-card-day-count')!),
      ).toBe(true)
    })

    it('puts the weekday letter above its flame — a column header, not a caption', () => {
      const { container } = render(
        <ChallengeCard
          focusPassport={passport({ streak: 2, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
        />,
      )
      const day = screen.getAllByTestId('challenge-week-day')[0]!
      const nodes = Array.from(day.querySelectorAll('*'))
      const letter = nodes.indexOf(
        day.querySelector('.challenge-card-week-letter')!,
      )
      const flame = nodes.indexOf(day.querySelector('.challenge-card-flame')!)
      expect(letter).toBeGreaterThanOrEqual(0)
      expect(flame).toBeGreaterThanOrEqual(0)
      expect(letter).toBeLessThan(flame)
    })

    it('makes the full-width week the Daily tap target, ordinal excluded', () => {
      const { container } = render(
        <ChallengeCard
          focusPassport={passport({ streak: 3, todayDone: false })}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
          onPassportTap={() => {}}
        />,
      )
      const block = screen.getByTestId('challenge-progress')
      expect(block.tagName).toBe('BUTTON')
      expect(
        block.contains(container.querySelector('.challenge-card-week')!),
      ).toBe(true)
      expect(
        block.contains(container.querySelector('.challenge-card-day-count')!),
      ).toBe(false)
    })

    it('drops the duration stat once enrolled — a sale term, not a status', () => {
      const { container } = render(
        <ChallengeCard
          focusPassport={passport({ streak: 4, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{
            active: true,
            source: 'season_pass',
            dayOfChallenge: 4,
            shieldsCredited: 3,
          }}
          onJoinChallenge={null}
          shields={{ count: 2, max: 3 }}
        />,
      )
      const stats = screen.getByTestId('challenge-stats')
      // "21-Day Mind Challenge" + "Day 4 of 21" already say it twice; inside
      // the challenge a third mention informs nobody.
      expect(stats).not.toHaveTextContent('21 days')
      expect(stats).toHaveTextContent('2/3 Shields')
      expect(stats).toHaveTextContent('Special Training')
      expect(
        container.querySelector('[data-theme-slot="hub.focus-passport-calendar"]'),
      ).toBeNull()
    })

    // ── Mini-tour spotlight ───────────────────────────────────────────────
    // Same granularity PLAY already uses: KingdomCard puts `data-tour-target`
    // on the PRO row, not on the whole panel. Lighting the entire card lit 4
    // tappable things at once (the `?`, the week into Daily, the CTA) and
    // taught none of them.
    it('anchors the tour spotlight on the CTA row, not on the whole panel', () => {
      const { container } = render(
        <ChallengeCard
          focusPassport={passport({ streak: 2 })}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
        />,
      )
      const row = container.querySelector('.challenge-card-cta-row')!
      expect(row).toHaveAttribute('data-tour-target', 'challenge')
      expect(
        container.querySelector('.challenge-card')!.getAttribute('data-tour-target'),
      ).toBeNull()
    })

    it('keeps the nudge arrow inside the spotlighted element', () => {
      // The arrow is CSS-gated on `[data-tour-spotlight="active"] .challenge-
      // card-join-arrow` — a DESCENDANT selector. Anchoring the tour on the
      // button alone would leave the arrow outside and blank it during the one
      // step that needs it.
      const { container } = render(
        <ChallengeCard
          focusPassport={passport({ streak: 2 })}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
        />,
      )
      const target = container.querySelector('[data-tour-target="challenge"]')!
      const arrow = container.querySelector('.challenge-card-join-arrow')!
      const cta = screen.getByTestId('challenge-cta')
      expect(target.contains(arrow)).toBe(true)
      expect(target.contains(cta)).toBe(true)
    })

    it('labels the day run as a streak, never as a Combo (canonical vocabulary)', () => {
      // Combo is the SESSION metric (chesscito:streak) and stays exclusive to
      // the exercise overlay / drawer — see the combo-streak vocabulary doc.
      render(
        <ChallengeCard
          focusPassport={passport({ streak: 3, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{
            active: true,
            source: 'season_pass',
            dayOfChallenge: 3,
            shieldsCredited: 3,
          }}
          onJoinChallenge={null}
        />,
      )
      const text = screen.getByTestId('challenge-card').textContent ?? ''
      expect(text).toMatch(/3-day streak/i)
      expect(text).not.toMatch(/combo/i)
    })
  })

  it('renders ES locale copy for the Join CTA (i18n parity)', () => {
    render(
      <ChallengeCard
        focusPassport={passport({ streak: 2 })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
      />,
      { locale: 'es' },
    )
    // The CTA must resolve to real ES copy, never the literal key path.
    expect(
      screen.getByTestId('challenge-cta').textContent ?? '',
    ).not.toMatch(/CHALLENGE_CARD_COPY/)
  })

  it('renders the compact ES Start Focus label without shortening its accessible name', () => {
    render(
      <ChallengeCard
        focusPassport={passport({ streak: 2, todayDone: false })}
        challenge={CHALLENGE}
        seasonPass={{ active: true, source: 'pro' }}
        onJoinChallenge={null}
        onFocusTap={() => {}}
      />,
      { locale: 'es' },
    )

    expect(screen.getByTestId('challenge-cta')).toHaveTextContent(
      /^Comenzar foco$/,
    )
    expect(
      screen.getByRole('button', { name: 'Comienza tu foco de hoy' }),
    ).toBeInTheDocument()
  })
})
