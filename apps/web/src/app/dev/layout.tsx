// VR fixture pages live outside the [locale] segment so baseline
// paths stay stable. This layout is now their de-facto root — after
// Stage 1 of the i18n migration there is no app/layout.tsx, so any
// global styling (Tailwind, design tokens) has to be loaded here too.
//
// As Stage C client components adopt `useTranslations`, the fixtures
// need a NextIntlClientProvider too — otherwise primitives like
// <TxProgressSteps>, <GlobalStatusBar>, etc. throw at mount. EN bundle
// only; fixtures are locale-agnostic by design.
// Fixtures render surfaces from every route, so the dev root loads the
// full split set (P4 CSS split) — prod routes load only their own file.
import '../globals.css'
import '@/styles/arena.css'
import '@/styles/hub.css'
import '@/styles/coach.css'
import '@/styles/exercises.css'
import { NextIntlClientProvider } from 'next-intl'
import enMessages from '@/lib/content/messages/en'

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
