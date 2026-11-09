import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithIntl as render, screen } from '@/test-utils/render-with-intl'

const statusMock = vi.hoisted(() => vi.fn())
const railMock = vi.hoisted(() => vi.fn())
const pushMock = vi.hoisted(() => vi.fn())
const pathnameMock = vi.hoisted(() => vi.fn(() => '/hub'))

// Sales ON here on purpose: these cases are about what the sheet SHOWS. The
// 2026-08-26 pause is covered by sheet-respects-the-pause.test.tsx; leaving it
// off here would render null and make every assertion below vacuous.
vi.mock('@/lib/feature-flags', () => ({
  CHESSCITO_LITE_MODE: true,
  isSeasonPassSalesEnabled: () => true,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => pathnameMock(),
}))
vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0xaaaabbbbccccddddeeeeffff0000111122223333' }),
  useChainId: () => 42220,
  usePublicClient: () => undefined,
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}))
vi.mock('@/lib/season-pass/use-season-pass-status', () => ({
  useSeasonPassStatus: statusMock,
}))
vi.mock('@/lib/season-pass/use-season-pass-rail', () => ({
  useSeasonPassRail: railMock,
}))
vi.mock('@/lib/payments/use-get-peones-token-selection', () => ({
  useStablecoinTokenSelection: () => ({
    selectedSymbol: 'USDC',
    selected: {
      symbol: 'USDC',
      balance: 5_000_000n,
      decimals: 6,
      payable: true,
    },
    tokens: [],
    noPayableToken: false,
    setSelectedSymbol: vi.fn(),
  }),
}))

import { SeasonPassSheet } from '../season-pass-sheet'

function defaultRail() {
  return {
    phase: 'idle',
    result: null,
    errorReason: null,
    available: true,
    pay: vi.fn(),
  }
}

describe('SeasonPassSheet', () => {
  it('shows Included with PRO and does not render a purchase CTA', () => {
    statusMock.mockReturnValue({
      active: true,
      source: 'pro',
      loading: false,
      seasonPassExpiresAt: null,
      proExpiresAt: Date.now() + 86_400_000,
      shieldsCredited: 0,
    })
    railMock.mockReturnValue(defaultRail())

    render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)

    expect(screen.getByTestId('season-pass-included-pro')).toHaveTextContent(
      'Included with PRO',
    )
    expect(screen.queryByTestId('season-pass-pay')).toBeNull()
    expect(screen.queryByText(/\+3 shields/i)).toBeNull()
  })

  it('keeps the direct Season Pass offer and +3 Shields for an inactive user', () => {
    statusMock.mockReturnValue({
      active: false,
      source: null,
      loading: false,
      seasonPassExpiresAt: null,
      proExpiresAt: null,
      shieldsCredited: 0,
    })
    railMock.mockReturnValue(defaultRail())

    render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)

    expect(screen.getByTestId('season-pass-pay')).toBeInTheDocument()
    expect(screen.getByText(/\+3 shields/i)).toBeInTheDocument()
  })
})

describe('SeasonPassSheet — visual offer', () => {
  beforeEach(() => {
    statusMock.mockReturnValue(INACTIVE_STATUS)
    railMock.mockReturnValue(defaultRail())
  })

  it('leads with the JOIN THE kicker and the challenge wordmark', () => {
    const { container } = render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)

    expect(screen.getByText('Join the')).toBeInTheDocument()
    expect(
      container.querySelector('img[src="/art/mini-tour/tour-challenge-title.png"]'),
    ).toBeInTheDocument()
  })

  it('tells the promise with the gift → training → streak row, in that order', () => {
    const { container } = render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)

    const row = container.querySelector('[data-testid="season-pass-story"]')
    expect(row).toBeInTheDocument()
    // Arrows sit BETWEEN the beats, never trailing: three icons, two arrows.
    expect([...row!.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toEqual([
      '/art/shop/welcome-gift.png',
      '/art/season/arrow-right.png',
      '/art/hub/train-pieces.png',
      '/art/season/arrow-right.png',
      '/art/focus-passport/flame-color.png',
    ])
  })

  it('labels the story beats: open gift → solve 1 tactic → build habit', () => {
    render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)

    const row = screen.getByTestId('season-pass-story')
    expect(row).toHaveTextContent('Open gift')
    expect(row).toHaveTextContent('Solve 1 tactic')
    expect(row).toHaveTextContent('Build habit')
  })

  it('shows the three benefits as icon tiles with interpolated labels', () => {
    const { container } = render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)

    const grid = container.querySelector('[data-testid="season-pass-benefits"]')
    expect(grid).toBeInTheDocument()
    expect([...grid!.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toEqual([
      '/art/21-day-icon.png',
      '/art/new-icons-chesscito/training-icon-v1.png',
      '/art/redesign/icons/shield.png',
    ])
    // Interpolated from the SKU, never hardcoded: a pass sold with 5 shields
    // must not advertise 3.
    expect(grid).toHaveTextContent('21 Days')
    expect(grid).toHaveTextContent('Special Trainings')
    expect(grid).toHaveTextContent('+3 Shields')
  })

  // AC6 · discriminación 21≠30 — la oferta nombra la meta DENTRO de la ventana.
  // No es "un desafío de 30 días": son 21 Focus Days con 30 días para lograrlos,
  // y las dos cifras tienen que aparecer con su rol correcto.
  it('AC6 · discriminación 21≠30 — vende 21 Focus Days dentro de una ventana de 30', () => {
    const { container } = render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)
    const text = container.textContent ?? ''

    // La meta sigue siendo 21, interpolada desde el SKU.
    const grid = container.querySelector('[data-testid="season-pass-benefits"]')
    expect(grid).toHaveTextContent('21')

    // Y la ventana de 30 se nombra: sin esto el jugador ve un countdown de 30
    // sobre una meta de 21 que nadie le explicó.
    expect(text).toMatch(/30/)

    // Lo que NO puede pasar: que la venta se convierta en un desafío de 30.
    expect(text).not.toMatch(/30[\s-]day challenge/i)
    expect(text).not.toMatch(/30 Focus Days/i)
  })

  it('keeps the long copy collapsed behind the help chip', () => {
    render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)

    expect(screen.getByTestId('season-pass-details-toggle')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByTestId('season-pass-details')).toBeNull()
    expect(screen.queryByText(/advanced challenges/i)).toBeNull()
    expect(screen.queryByText(/direct-purchase/i)).toBeNull()
  })

  it('reveals and re-hides the long copy on the help chip', async () => {
    render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)
    const toggle = screen.getByTestId('season-pass-details-toggle')

    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('season-pass-details')).toHaveTextContent(/advanced challenges/i)
    expect(screen.getByTestId('season-pass-details')).toHaveTextContent(/direct-purchase/i)

    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('season-pass-details')).toBeNull()
  })

  it('floats the disclosure over the offer instead of pushing it down', async () => {
    // It hangs inside the habit block, which is the positioning context. A
    // sibling in the sheet's own column would reflow every row below it —
    // price, picker and CTA would jump under the reader's thumb.
    render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)
    await userEvent.click(screen.getByTestId('season-pass-details-toggle'))

    const habit = screen.getByTestId('season-pass-habit')
    expect(habit).toContainElement(screen.getByTestId('season-pass-details'))
    // A popover, not a modal: the sheet already owns the only aria-modal.
    expect(screen.getByTestId('season-pass-details')).not.toHaveAttribute('aria-modal')
  })

  it('says the habit promise in one line', () => {
    render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)

    expect(screen.getByTestId('season-pass-habit')).toHaveTextContent(
      'Build your daily focus habit.',
    )
  })

  it('heads the token picker with a PAY WITH separator', () => {
    const { container } = render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)

    const header = container.querySelector('[data-testid="season-pass-paywith"]')
    expect(header).toHaveTextContent('Pay with')
    expect(
      header!.querySelector('img[src="/art/screen-mission/adorno-icon.png"]'),
    ).toBeInTheDocument()
    // The picker itself is untouched — same testid, same wiring.
    expect(screen.getByTestId('season-pass-token-trigger')).toBeInTheDocument()
  })

  it('sells the CTA without repeating the price, and closes with the payment note', () => {
    render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)

    const cta = screen.getByTestId('season-pass-pay')
    expect(cta).toHaveTextContent('Unlock Challenge')
    expect(cta).not.toHaveTextContent('$0.99')

    expect(screen.getByTestId('season-pass-note')).toHaveTextContent(
      'One-time payment · No subscription',
    )
    expect(screen.queryByText(/paid with .* on celo/i)).toBeNull()
  })
})

function successRail(shieldsCredited: number) {
  return {
    ...defaultRail(),
    phase: 'success',
    result: {
      shieldsCredited,
      duplicate: false,
      expiresAt: new Date(Date.now() + 21 * 86_400_000).toISOString(),
    },
  }
}

const INACTIVE_STATUS = {
  active: false,
  source: null,
  loading: false,
  seasonPassExpiresAt: null,
  proExpiresAt: null,
  shieldsCredited: 0,
}

describe('SeasonPassSheet — post-purchase celebration', () => {
  beforeEach(() => {
    pushMock.mockClear()
    pathnameMock.mockReturnValue('/hub')
  })

  it('celebrates the verified purchase with the pass duration and shields', () => {
    statusMock.mockReturnValue(INACTIVE_STATUS)
    railMock.mockReturnValue(successRail(3))

    render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)

    expect(screen.getByTestId('season-pass-celebration')).toBeInTheDocument()
    expect(screen.getByText('You are in!')).toBeInTheDocument()
    expect(screen.getByTestId('season-pass-celebration-stats')).toHaveTextContent('21 days')
    expect(screen.getByTestId('season-pass-celebration-stats')).toHaveTextContent('+3 Shields')
    expect(screen.getByTestId('confetti-burst')).toBeInTheDocument()
    expect(screen.getByTestId('season-pass-start-focus')).toHaveTextContent('Start Focus')
  })

  it('never promises shields the wallet did not receive', () => {
    // verify-payment answers shieldsCredited: 0 when the payment settled but
    // the Redis grant failed — the pass is active, the shields are not yet.
    statusMock.mockReturnValue(INACTIVE_STATUS)
    railMock.mockReturnValue(successRail(0))

    render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)

    const stats = screen.getByTestId('season-pass-celebration-stats')
    expect(stats).toHaveTextContent('Shields soon')
    expect(stats).not.toHaveTextContent('+0 Shields')
  })

  it('routes Start Focus to /exercises', async () => {
    statusMock.mockReturnValue(INACTIVE_STATUS)
    railMock.mockReturnValue(successRail(3))

    render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)
    await userEvent.click(screen.getByTestId('season-pass-start-focus'))

    expect(pushMock).toHaveBeenCalledWith('/exercises')
  })

  it('closes instead of navigating when the buyer is already on /exercises', async () => {
    // Buying from the LEARN dock: a push to the current route is a no-op that
    // would strand the celebration on screen.
    pathnameMock.mockReturnValue('/exercises')
    statusMock.mockReturnValue(INACTIVE_STATUS)
    railMock.mockReturnValue(successRail(3))
    const onOpenChange = vi.fn()

    render(<SeasonPassSheet open={true} onOpenChange={onOpenChange} />)
    await userEvent.click(screen.getByTestId('season-pass-start-focus'))

    expect(pushMock).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('outranks a refreshed active entitlement', () => {
    // The host refreshes the pass status on success. Without the celebration
    // taking precedence, the sheet would flip to "Pass Active" and swallow it.
    statusMock.mockReturnValue({
      active: true,
      source: 'season_pass',
      loading: false,
      seasonPassExpiresAt: new Date(Date.now() + 21 * 86_400_000).toISOString(),
      proExpiresAt: null,
      shieldsCredited: 3,
    })
    railMock.mockReturnValue(successRail(3))

    render(<SeasonPassSheet open={true} onOpenChange={() => {}} />)

    expect(screen.getByTestId('season-pass-celebration')).toBeInTheDocument()
    expect(screen.queryByTestId('season-pass-already-active')).toBeNull()
  })
})
