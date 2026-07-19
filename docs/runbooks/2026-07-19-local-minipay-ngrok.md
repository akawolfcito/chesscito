# Local MiniPay testing through ngrok

Use this flow whenever PLAY or LEARN is opened from MiniPay against a local
Next.js process. `/api/pro/status` validates the request host; the tunnel used
by MiniPay must therefore be present in the local public-origin configuration.

## Start a tunnel

Start the web app on the intended port and expose that same port:

```bash
pnpm --filter web dev
ngrok http 3000
```

Copy the HTTPS forwarding URL shown by ngrok. Treat it as one exact value; do
not mix the old tunnel hostname with the new one.

## Configure both accepted public URLs

Set both variables in the ignored local environment used to start Next.js:

```text
NEXT_PUBLIC_APP_URL=https://<subdomain>.ngrok-free.app
NEXT_PUBLIC_PREVIEW_URL=https://<subdomain>.ngrok-free.app
```

Both values are required for a predictable PLAY/LEARN local workflow. No
private key, token, Redis URL, Supabase credential or RPC secret belongs in a
public variable.

## Restart after every change

Stop and restart the Next.js dev process after changing the tunnel or either
public URL. Next.js captures `NEXT_PUBLIC_*` values at startup. A browser reload
alone does not update the server allowlist or the client-side DEV check.

Then open the same HTTPS ngrok URL from MiniPay Developer Settings → Load Test
Page.

## What the DEV warning means

In local development, a banner reading `DEV: PRO origin mismatch` means the
current MiniPay host is not accepted by the same classifier used by
`/api/pro/status`.

The classifier intentionally mirrors the current server boundary:

- it compares `URL.host`;
- hostname and explicit port matter;
- protocol does not participate;
- changing the server to full-origin comparison is a separate security change.

The warning is read-only. It does not modify entitlements, localStorage,
profiles, Redis, Supabase or on-chain data.

## Expected recovery

After setting both URLs to the active tunnel and restarting:

1. the DEV warning disappears;
2. `/api/pro/status` no longer fails because of the tunnel host;
3. PLAY and LEARN can resolve the same PRO truth as their corresponding
   Preview environments.

An HTTP or network failure remains `error`/`unknown`; it is never interpreted
as confirmed inactive. Do not use either reset route to repair an origin
configuration problem.

## Reset-route distinction

- `/dev/reset`: valid local/Preview DEV utility for `chesscito*` localStorage.
- `/lite-debug/reset`: separate LEARN-only QA reset, available only when
  `ENABLE_LITE_QA_RESET=true`.

Neither route is part of the ngrok-origin recovery flow.
