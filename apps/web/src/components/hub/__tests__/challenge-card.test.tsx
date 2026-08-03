import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent } from '@testing-library/react'
import { renderWithIntl as render, screen } from '@/test-utils/render-with-intl'

import { ChallengeCard } from '../challenge-card'
import type { ChallengeCardProps } from '../challenge-card'
import type { ChallengeProgressView } from '@/lib/season-pass/focus-days'

// Same guardrail the FocusPassport leaf enforces: no web3 / medical claims.
const FORBIDDEN =
  /verified|on-?chain|\bNFT\b|\bmint\b|proof|brain health|cure|improves (focus|memory)/i

const CHALLENGE: ChallengeCardProps['challenge'] = {
  challengeGoalDays: 21,
  accessDurationDays: 30,
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

/** Renders the card with a `progress` view inferred from the commercial state,
 *  so the tests that are ABOUT something else (CTA wiring, week row, copy
 *  guardrails) stay readable. Tests that are about progress pass it
 *  explicitly — the inference here is a test convenience and deliberately NOT
 *  what the product does: the real view comes from the ledger, never from the
 *  pass or the streak. */
function Card({
  progress,
  ...props
}: Omit<ChallengeCardProps, 'progress'> & {
  progress?: ChallengeProgressView
}) {
  const inferred: ChallengeProgressView = props.seasonPass.active
    ? {
        state: 'active',
        progress: { completed: 0, goal: props.challenge.challengeGoalDays },
        window: { kind: 'expiring', daysRemaining: props.challenge.accessDurationDays },
        streak: Math.max(0, props.focusPassport.streak),
        unreachable: false,
      }
    : props.seasonPass.isLoading
      ? { state: 'loading' }
      : { state: 'offer' }
  return <ChallengeCard {...props} progress={progress ?? inferred} />
}

afterEach(() => {
  cleanup()
})

/** The five ledger states (founder sign-off, 2026-07-27). The rule that binds
 *  them: `disabled` is a decision of OURS and says nothing about itself;
 *  `degraded` is a failure of ours and says so. A card that paints them alike
 *  hides an incident behind a feature flag. */
describe('<ChallengeCard> — Focus Days states', () => {
  const ACTIVE_PASS: ChallengeCardProps['seasonPass'] = {
    active: true,
    source: 'season_pass',
    shieldsCredited: 3,
  }
  const WINDOW = { kind: 'expiring', daysRemaining: 9 } as const

  function renderState(progress: ChallengeProgressView) {
    render(
      <Card
        focusPassport={passport({ streak: 4, todayDone: false })}
        challenge={CHALLENGE}
        seasonPass={ACTIVE_PASS}
        progress={progress}
        onJoinChallenge={null}
        onFocusTap={() => {}}
      />,
    )
    return screen.getByTestId('challenge-card')
  }

  it('disabled: no error copy, no progress, no spinner — window, streak and CTA intact', () => {
    const card = renderState({ state: 'disabled', window: WINDOW, streak: 4 })

    expect(card).toHaveAttribute('data-progress-state', 'disabled')
    // Never leaks the operational decision to the player.
    expect(card.textContent).not.toMatch(/unavailable|disabled|tracking is off/i)
    expect(screen.queryByTestId('challenge-progress-line')).toBeNull()
    expect(screen.queryByTestId('challenge-progress-unavailable')).toBeNull()
    expect(card).not.toHaveAttribute('aria-busy', 'true')
    expect(screen.getByTestId('challenge-window').textContent).toMatch(/9 days left/i)
    expect(screen.getByTestId('challenge-streak').textContent).toMatch(/4-day streak/i)
    expect(screen.getByTestId('challenge-cta')).toHaveAttribute('data-cta-state', 'start')
  })

  it('degraded: says the metric is missing, and never substitutes the streak for it', () => {
    const card = renderState({ state: 'degraded', window: WINDOW, streak: 4 })

    expect(card).toHaveAttribute('data-progress-state', 'degraded')
    expect(screen.getByTestId('challenge-progress-unavailable').textContent).toMatch(
      /Focus progress is temporarily unavailable/i,
    )
    expect(screen.queryByTestId('challenge-progress-line')).toBeNull()
    // The streak is visible as its own metric but is never dressed up as a count.
    expect(card.textContent).not.toMatch(/\b4 of 21\b/i)
    expect(focusDays()).toBe(0)
    // Access and the action survive OUR failure.
    expect(screen.getByTestId('challenge-window').textContent).toMatch(/9 days left/i)
    expect(screen.getByTestId('challenge-cta')).toHaveAttribute('data-cta-state', 'start')
  })

  it('neither disabled nor degraded revives the retired "Day N of 21" ordinal', () => {
    for (const state of ['disabled', 'degraded'] as const) {
      cleanup()
      const card = renderState({ state, window: WINDOW, streak: 4 })
      expect(card.textContent).not.toMatch(/Day \d+ of 21/i)
    }
  })

  it('active: counts the ledger rows, with the window as a separate metric', () => {
    renderState({
      state: 'active',
      progress: { completed: 12, goal: 21 },
      window: WINDOW,
      streak: 4,
      unreachable: false,
    })

    expect(screen.getByTestId('challenge-progress-line').textContent).toMatch(
      /12 of 21 Focus Days/i,
    )
    expect(screen.getByTestId('challenge-window').textContent).toMatch(/9 days left/i)
    expect(screen.queryByTestId('challenge-unreachable')).toBeNull()
  })

  it('unreachable: explains the state and KEEPS the CTA, progress and countdown', () => {
    // Replacing the CTA would turn a warning into a dead end. The Daily is
    // still worth doing even when 21 is out of reach.
    renderState({
      state: 'active',
      progress: { completed: 12, goal: 21 },
      window: { kind: 'expiring', daysRemaining: 4 },
      streak: 4,
      unreachable: true,
    })

    expect(screen.getByTestId('challenge-unreachable').textContent).toMatch(
      /Keep building the habit/i,
    )
    expect(screen.getByTestId('challenge-progress-line').textContent).toMatch(
      /12 of 21 Focus Days/i,
    )
    expect(screen.getByTestId('challenge-window').textContent).toMatch(/4 days left/i)
    expect(screen.getByTestId('challenge-cta')).toHaveAttribute('data-cta-state', 'start')
    // Never defeatist, never "you already lost".
    expect(screen.getByTestId('challenge-card').textContent).not.toMatch(
      /failed|lost|too late|no longer possible/i,
    )
  })

  it('PRO: no countdown to miss, so never unreachable', () => {
    render(
      <Card
        focusPassport={passport({ streak: 4 })}
        challenge={CHALLENGE}
        seasonPass={{ active: true, source: 'pro' }}
        progress={{
          state: 'active',
          progress: { completed: 2, goal: 21 },
          window: { kind: 'unbounded' },
          streak: 4,
          unreachable: false,
        }}
        onJoinChallenge={null}
        onFocusTap={() => {}}
      />,
    )
    // The badge carries it, and ONLY the badge: an unbounded window renders no
    // countdown element at all. What must never appear is a number — a "0 days
    // left" here would read as an expired pass to a subscriber who has none.
    expect(screen.getByTestId('challenge-active-badge').textContent).toMatch(
      /included/i,
    )
    expect(screen.queryByTestId('challenge-window')).toBeNull()
    expect(screen.queryByTestId('challenge-unreachable')).toBeNull()
  })

  it('loading is exclusively a pending request, never a state with a number', () => {
    const card = renderState({ state: 'loading' })

    expect(card).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByTestId('challenge-progress-line')).toBeNull()
    expect(screen.queryByTestId('challenge-progress-unavailable')).toBeNull()
    expect(screen.queryByTestId('challenge-window')).toBeNull()
  })
})

describe('<ChallengeCard>', () => {
  it('shows the Focus Passport `?` and replays the tour on tap, without a Join dependency', () => {
    const onReplayTour = vi.fn()
    render(
      <Card
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
      <Card
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
      <Card
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
      <Card
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
      <Card
        focusPassport={passport()}
        challenge={CHALLENGE}
        seasonPass={{ active: true, source: 'season_pass', shieldsCredited: 3 }}
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
      <Card
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
      <Card
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

  it('offer (not joined): inline stats + Join CTA, no progress claim', () => {
    const onJoin = vi.fn()
    render(
      <Card
        focusPassport={passport({ streak: 3, todayDone: true })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={onJoin}
      />,
    )
    expect(focusDays()).toBe(0)
    const card = screen.getByTestId('challenge-card')
    // The retired ordinal. It advanced with the calendar while its number came
    // from the streak, so it walked backward after a skipped day.
    expect(card.textContent).not.toMatch(/Day \d+ of 21/i)
    expect(card.textContent).toMatch(/\+3/)
    expect(card.textContent).toMatch(/\$1\.99/)
    expect(card.textContent).toMatch(/21-Day Mind Challenge/i)
    const cta = screen.getByTestId('challenge-cta')
    // The offer wears the Season Pass banner, not the green primary skin
    // (founder, 2026-08-03) — `challenge-card-cta` survives because that class
    // owns the pulse and its reduced-motion override, not the look.
    expect(cta).toHaveClass('season-pass-banner', 'challenge-card-cta')
    fireEvent.click(cta)
    expect(onJoin).toHaveBeenCalledTimes(1)
    // No active-only affordances in the offer state.
    expect(screen.queryByTestId('challenge-active-badge')).toBeNull()
  })

  it('pending flame block opens Daily through its dedicated callback, never the Exercises CTA callback', () => {
    const onPassportTap = vi.fn()
    const onFocusTap = vi.fn()
    render(
      <Card
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
      <Card
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
      <Card
        focusPassport={passport({ streak: 1 })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
      />,
    )
    expect(screen.getByTestId('challenge-progress').tagName).toBe('DIV')

    rerender(
      <Card
        focusPassport={passport({ streak: 1, isLoading: true })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
        onPassportTap={() => {}}
      />,
    )
    expect(screen.getByTestId('challenge-progress').tagName).toBe('DIV')

    rerender(
      <Card
        focusPassport={passport({ streak: 1, todayDone: true })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
        onPassportTap={() => {}}
      />,
    )
    expect(screen.getByTestId('challenge-progress').tagName).toBe('DIV')
  })

  it('offer: a long streak buys no progress at all', () => {
    // Progress belongs to the pass. Before joining there is nothing to count,
    // and the streak must not be dressed up as a head start.
    render(
      <Card
        focusPassport={passport({ streak: 40, todayDone: true })}
        challenge={CHALLENGE}
        seasonPass={{ active: false, isLoading: false }}
        onJoinChallenge={() => {}}
      />,
    )
    expect(focusDays()).toBe(0)
    expect(screen.queryByTestId('challenge-progress-line')).toBeNull()
  })

  it('active (joined): ACTIVE badge, live shields benefit, no Join CTA', () => {
    render(
      <Card
        focusPassport={passport({ streak: 1, todayDone: true })}
        challenge={CHALLENGE}
        seasonPass={{
          active: true,
          source: 'season_pass',
          shieldsCredited: 3,
        }}
        onJoinChallenge={null}
        shields={{ count: 2 }}
      />,
    )
    expect(screen.getByTestId('challenge-active-badge')).toBeInTheDocument()
    const card = screen.getByTestId('challenge-card')
    expect(screen.getByTestId('challenge-shields')).toHaveTextContent('2 Shields')
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
      <Card
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
      <Card
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
        <Card
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
        <Card
          focusPassport={passport({ streak: 3, todayDone: false })}
          challenge={CHALLENGE}
          seasonPass={{
            active: true,
            source: 'season_pass',
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
        <Card
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
        <Card
          focusPassport={passport({ streak: 5, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{
            active: true,
            source: 'season_pass',
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

    it('shows CHALLENGE COMPLETE when the LEDGER says the goal is met', () => {
      render(
        <Card
          focusPassport={passport({ streak: 21, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{
            active: true,
            source: 'season_pass',
            shieldsCredited: 3,
          }}
          progress={{
            state: 'completed',
            progress: { completed: 21, goal: 21 },
            window: { kind: 'expiring', daysRemaining: 2 },
            streak: 21,
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
          shieldsCredited: 3,
        },
      ]
      for (const seasonPass of states) {
        const { unmount } = render(
          <Card
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

    it('wears the Season Pass banner and shows the price as an inline chip', () => {
      render(
        <Card
          focusPassport={passport()}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
        />,
      )
      expect(cta().className).toContain('season-pass-banner')
      // The price moved OUT of the floating badge (Save Victory pattern) and
      // into the banner's own chip, where the landing already shows it. It is
      // inline, so it can never overlap the label the way an absolutely
      // positioned badge could.
      expect(cta().querySelector('.challenge-card-cta-badge')).toBeNull()
      const chip = cta().querySelector('.season-pass-banner-price')
      expect(chip?.textContent).toBe('$1.99')
    })

    it('keeps the tour arrow on the same row as the CTA it points at', () => {
      const { container } = render(
        <Card
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
        <Card
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
        <Card
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
        <Card
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
        <Card
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
        <Card
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
        <Card
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
        <Card
          focusPassport={passport({ streak: 4, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{
            active: true,
            source: 'season_pass',
            shieldsCredited: 3,
          }}
          onJoinChallenge={null}
          shields={{ count: 2 }}
        />,
      )
      expect(screen.queryByTestId('challenge-day')).toBeNull()
      // No "/3". The 3 was never a capacity the player could fill — the
      // displayed balance is min(3, credited - consumed), so a cap in the copy
      // promised a tank that does not exist: it made 0 read as terminal, and it
      // hid every shield credited past the third.
      expect(screen.getByTestId('challenge-shields')).toHaveTextContent(
        '2 Shields',
      )
      expect(screen.getByTestId('challenge-shields')).not.toHaveTextContent('/')
      expect(screen.getByTestId('challenge-stats')).not.toHaveTextContent('+3')
    })

    it('omits Day X / 21 for PRO — the challenge day is not modelled there', () => {
      render(
        <Card
          focusPassport={passport({ streak: 4, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{ active: true, source: 'pro' }}
          onJoinChallenge={null}
          shields={{ count: 3 }}
        />,
      )
      expect(screen.queryByTestId('challenge-day')).toBeNull()
      // No calendar ordinal anywhere anymore, for PRO or anyone else.
      expect(screen.getByTestId('challenge-card').textContent).not.toMatch(
        /Day \d+ of 21/i,
      )
    })

    it('shows only the +N purchase bonus in the offer state', () => {
      // "+3 Shields" (what you will receive) next to the balance (what you
      // hold) read as two answers to the same question. Before the purchase,
      // only the bonus is meaningful.
      render(
        <Card
          focusPassport={passport({ streak: 1 })}
          challenge={CHALLENGE}
          seasonPass={{ active: false, isLoading: false }}
          onJoinChallenge={() => {}}
          shields={{ count: 0 }}
        />,
      )
      expect(screen.getByTestId('challenge-shields')).toHaveTextContent(
        '+3 Shields',
      )
      expect(screen.getByTestId('challenge-stats')).not.toHaveTextContent(
        /\b0 Shields\b/,
      )
    })

    it('omits an unavailable active balance instead of inventing one', () => {
      render(
        <Card
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
        <Card
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
        <Card
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
        <Card
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
        <Card
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
        <Card
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
        <Card
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
        <Card
          focusPassport={passport({ streak: 4, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{
            active: true,
            source: 'season_pass',
            shieldsCredited: 3,
          }}
          onJoinChallenge={null}
          shields={{ count: 2 }}
        />,
      )
      const stats = screen.getByTestId('challenge-stats')
      // "21-Day Mind Challenge" + "Day 4 of 21" already say it twice; inside
      // the challenge a third mention informs nobody.
      expect(stats).not.toHaveTextContent('21 days')
      expect(stats).toHaveTextContent('2 Shields')
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
        <Card
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
        <Card
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
        <Card
          focusPassport={passport({ streak: 3, todayDone: true })}
          challenge={CHALLENGE}
          seasonPass={{
            active: true,
            source: 'season_pass',
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
      <Card
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
      <Card
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

/** The Season Pass banner — the SAME shape the landing shows on slide 2, so a
 *  player who met the pass during onboarding recognises it here. On the landing
 *  it is decorative; here it is the real purchase CTA, and it replaces the
 *  `join` button ONLY: the other three CTA states keep the plain button skin. */
describe('<ChallengeCard> — the Season Pass banner', () => {
  const OFFER: ChallengeCardProps['seasonPass'] = { active: false, isLoading: false }

  function renderOffer(onJoinChallenge: (() => void) | null) {
    render(
      <Card
        focusPassport={passport({ streak: 1 })}
        challenge={CHALLENGE}
        seasonPass={OFFER}
        onJoinChallenge={onJoinChallenge}
      />,
    )
    return screen.getByTestId('challenge-cta')
  }

  it('wears the banner in the join state, keeping the CTA hooks', () => {
    const cta = renderOffer(() => {})

    expect(cta).toHaveClass('season-pass-banner')
    expect(cta.tagName).toBe('BUTTON')
    expect(cta).toHaveAttribute('data-cta-state', 'join')
  })

  it('shows the price as a chip and still says it in the accessible name', () => {
    const cta = renderOffer(() => {})

    // Visible chip: the recall cue. The landing shows the same one.
    expect(screen.getByTestId('challenge-cta-price')).toHaveTextContent('$1.99')
    // ...and the price stays INSIDE the button's accessible name. A chip that
    // only exists visually leaves a screen reader buying blind.
    expect(cta.getAttribute('aria-label') ?? '').toContain('$1.99')
  })

  it('hides the chevron from assistive tech', () => {
    renderOffer(() => {})

    expect(screen.getByTestId('challenge-cta-chevron')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  it('carries the pass icon, the same slot the card header uses', () => {
    renderOffer(() => {})

    expect(screen.getByTestId('challenge-cta-icon')).toBeInTheDocument()
  })

  it('does not pulse while the purchase is still resolving', () => {
    const cta = renderOffer(null)

    expect(cta).toBeDisabled()
    expect(cta).not.toHaveClass('is-pulsing')
  })

  it('fires the purchase on tap', () => {
    const onJoin = vi.fn()
    const cta = renderOffer(onJoin)

    fireEvent.click(cta)

    expect(onJoin).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['start', { active: true, source: 'pro' } as const, false],
    ['tomorrow', { active: true, source: 'pro' } as const, true],
  ])('leaves the %s state on the plain button skin', (_state, pass, todayDone) => {
    render(
      <Card
        focusPassport={passport({ streak: 2, todayDone })}
        challenge={CHALLENGE}
        seasonPass={pass}
        onJoinChallenge={null}
        onFocusTap={() => {}}
      />,
    )

    expect(screen.getByTestId('challenge-cta')).not.toHaveClass('season-pass-banner')
    expect(screen.queryByTestId('challenge-cta-price')).not.toBeInTheDocument()
  })
})
