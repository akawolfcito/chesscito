// VR fixture pages live outside the [locale] segment so baseline
// paths stay stable. This layout is now their de-facto root — after
// Stage 1 of the i18n migration there is no app/layout.tsx, so any
// global styling (Tailwind, design tokens) has to be loaded here too.
//
// As Stage C client components adopt `useTranslations`, the fixtures
// need a NextIntlClientProvider too — otherwise primitives like
// <TxProgressSteps>, <GlobalStatusBar>, etc. throw at mount. EN bundle
// only; fixtures are locale-agnostic by design.
import '../globals.css'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider } from 'next-intl'
import enMessages from '@/lib/content/messages/en'
import { isDevSurfaceEnabled } from '@/lib/dev/dev-surface'

export const metadata = {
  title: 'Chesscito — Dev Fixtures',
  description: 'Internal VR fixture harness for Chesscito. Not user-facing.',
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The gate for the WHOLE /dev subtree, and the only one that really holds.
  //
  // ⚠️ Most /dev pages are `"use client"`, and Next inlines only NODE_ENV and
  // NEXT_PUBLIC_* into the browser bundle — `process.env.VERCEL_ENV` reads
  // undefined there, so a gate inside a client page is SSR-only in practice.
  // This layout is a SERVER component, so its check is real; and a new probe
  // inherits it instead of having to remember it.
  if (!isDevSurfaceEnabled()) notFound()

  return (
    <html lang="en">
      <body>
        <NextIntlClientProvider locale="en" messages={enMessages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
