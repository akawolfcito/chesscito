'use client'

import { useCallback, useEffect, useState } from 'react'

/** Device probe for the private-duel P0 (spec 2026-07-13, red-team v3).
 *
 *  The question this answers, and that nothing else can: when B taps the duel
 *  link from a chat app, does B land somewhere that has BOTH a wallet AND the
 *  `?challenge=` code? If no context has both, the link cannot carry the
 *  challenge and the feature needs a different entry (e.g. a short code the
 *  player types in).
 *
 *  Deliberately talks to `window.ethereum` directly instead of wagmi: this page
 *  must render in webviews that have no provider at all, and a wagmi hook would
 *  throw `WagmiProviderNotFoundError` before printing anything.
 */

const COOKIE_NAME = 'chesscito_probe_session'
const STORAGE_KEY = 'chesscito:probe:session'

type EthereumProvider = {
  isMiniPay?: boolean
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

type ProbeWindow = Window & {
  ethereum?: EthereumProvider | null
  provider?: EthereumProvider | null
}

function readProvider(): EthereumProvider | null {
  if (typeof window === 'undefined') return null
  const w = window as ProbeWindow
  return w.ethereum ?? w.provider ?? null
}

function readCookie(name: string): string | null {
  const hit = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return String(err)
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '8px 0',
        borderBottom: '1px solid #2a2a2a',
        alignItems: 'baseline',
      }}
    >
      <span style={{ color: '#888', minWidth: 132, flexShrink: 0, fontSize: 12 }}>{label}</span>
      <span style={{ wordBreak: 'break-all', fontSize: 13 }}>{value}</span>
    </div>
  )
}

export default function DuelLinkProbePage() {
  const [href, setHref] = useState('—')
  const [challenge, setChallenge] = useState<string | null>(null)
  const [userAgent, setUserAgent] = useState('—')
  const [hasProvider, setHasProvider] = useState(false)
  const [isMiniPay, setIsMiniPay] = useState(false)
  const [account, setAccount] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [signMs, setSignMs] = useState<number | null>(null)
  const [cookieSeen, setCookieSeen] = useState<string | null>(null)
  const [storageSeen, setStorageSeen] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])

  const say = useCallback((line: string) => {
    setLog((prev) => [...prev, line])
  }, [])

  // Snapshot the environment on mount. Everything here is read-only — the page
  // must print a full report even when it lands in a webview with no wallet.
  useEffect(() => {
    setHref(window.location.href)
    setChallenge(new URLSearchParams(window.location.search).get('challenge'))
    setUserAgent(navigator.userAgent)

    const provider = readProvider()
    setHasProvider(Boolean(provider))
    setIsMiniPay(Boolean(provider?.isMiniPay))

    setCookieSeen(readCookie(COOKIE_NAME))
    try {
      setStorageSeen(window.localStorage.getItem(STORAGE_KEY))
    } catch (err) {
      setStorageSeen(`unavailable: ${errorText(err)}`)
    }
  }, [])

  const connect = useCallback(async () => {
    const provider = readProvider()
    if (!provider) {
      say('connect: NO PROVIDER — there is no wallet in this browser.')
      return
    }
    try {
      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
      const first = accounts?.[0] ?? null
      setAccount(first)
      say(first ? `connect: ok — ${first}` : 'connect: returned no accounts')
    } catch (err) {
      say(`connect: FAILED — ${errorText(err)}`)
    }
  }, [say])

  const sign = useCallback(async () => {
    const provider = readProvider()
    if (!provider || !account) {
      say('sign: needs a connected account first.')
      return
    }

    const message = [
      'chesscito.xyz wants you to sign in with your wallet.',
      '',
      `Wallet:     ${account}`,
      `Nonce:      ${crypto.randomUUID()}`,
      `Issued At:  ${new Date().toISOString()}`,
      'Chain:      Celo (42220)',
      '',
      'This signature authenticates you to Chesscito. It is NOT a transaction:',
      'it cannot move funds, and it costs no gas.',
    ].join('\n')

    const startedAt = Date.now()
    try {
      const sig = (await provider.request({
        method: 'personal_sign',
        params: [message, account],
      })) as string
      const elapsed = Date.now() - startedAt
      setSignature(sig)
      setSignMs(elapsed)
      say(`sign: ok in ${elapsed}ms`)
    } catch (err) {
      say(`sign: FAILED after ${Date.now() - startedAt}ms — ${errorText(err)}`)
    }
  }, [account, say])

  // Writes both a cookie and a localStorage entry so the reload can tell us
  // which of the two (if either) this webview actually keeps.
  const writeSession = useCallback(() => {
    const stamp = new Date().toISOString()
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(stamp)}; path=/; max-age=86400; SameSite=Lax`
    try {
      window.localStorage.setItem(STORAGE_KEY, stamp)
    } catch (err) {
      say(`storage write: FAILED — ${errorText(err)}`)
    }
    setCookieSeen(readCookie(COOKIE_NAME))
    say(`wrote session marker: ${stamp} — now close this page, reopen the link, and check "on load".`)
  }, [say])

  const canAcceptADuel = hasProvider && challenge !== null

  return (
    <main
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        background: '#111',
        color: '#eee',
        minHeight: '100vh',
        padding: 16,
        maxWidth: 390,
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Duel link probe</h1>
      <p style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>
        Open this link from WhatsApp, from the system browser, and from inside MiniPay. Screenshot
        each one. The differences between them are the result.
      </p>

      <div
        style={{
          background: canAcceptADuel ? '#0f3d1f' : '#3d0f0f',
          border: `1px solid ${canAcceptADuel ? '#1f7a3d' : '#7a1f1f'}`,
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <strong style={{ fontSize: 14 }}>
          {canAcceptADuel ? 'CAN ACCEPT A DUEL HERE' : 'CANNOT ACCEPT A DUEL HERE'}
        </strong>
        <div style={{ fontSize: 12, color: '#bbb', marginTop: 4 }}>
          Needs a wallet AND the challenge code. wallet={String(hasProvider)} · challenge=
          {String(challenge !== null)}
        </div>
      </div>

      <h2 style={{ fontSize: 14, margin: '16px 0 4px' }}>On load</h2>
      <Row label="challenge param" value={challenge ?? '❌ LOST — not in the URL'} />
      <Row label="wallet injected" value={hasProvider ? '✅ yes' : '❌ no'} />
      <Row label="isMiniPay" value={isMiniPay ? '✅ yes' : 'no'} />
      <Row label="cookie survived" value={cookieSeen ?? '❌ none'} />
      <Row label="localStorage" value={storageSeen ?? '❌ none'} />
      <Row label="URL" value={href} />
      <Row label="user agent" value={userAgent} />

      <h2 style={{ fontSize: 14, margin: '16px 0 4px' }}>Actions</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" onClick={connect} style={buttonStyle}>
          1 · Connect wallet
        </button>
        <button type="button" onClick={sign} style={buttonStyle} disabled={!account}>
          2 · Sign (personal_sign)
        </button>
        <button type="button" onClick={writeSession} style={buttonStyle}>
          3 · Write session marker, then reopen the link
        </button>
      </div>

      <h2 style={{ fontSize: 14, margin: '16px 0 4px' }}>Results</h2>
      <Row label="account" value={account ?? '—'} />
      <Row label="signature" value={signature ? `${signature.slice(0, 24)}…` : '—'} />
      <Row label="sign latency" value={signMs === null ? '—' : `${signMs}ms`} />

      <h2 style={{ fontSize: 14, margin: '16px 0 4px' }}>Log</h2>
      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#9c9' }}>
        {log.length ? log.join('\n') : '—'}
      </pre>
    </main>
  )
}

const buttonStyle: React.CSSProperties = {
  background: '#222',
  color: '#eee',
  border: '1px solid #444',
  borderRadius: 8,
  padding: '12px 14px',
  fontSize: 14,
  fontFamily: 'inherit',
  textAlign: 'left',
}
