import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithIntl as render, screen } from '@/test-utils/render-with-intl'

const statusMock = vi.hoisted(() => vi.fn())
const railMock = vi.hoisted(() => vi.fn())
const pushMock = vi.hoisted(() => vi.fn())
const pathnameMock = vi.hoisted(() => vi.fn(() => '/hub'))

vi.mock('@/lib/feature-flags', () => ({ CHESSCITO_LITE_MODE: true }))
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
