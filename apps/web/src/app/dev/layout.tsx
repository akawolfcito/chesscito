// VR fixture pages live outside the [locale] segment so baseline
// paths stay stable. This layout is now their de-facto root — after
// Stage 1 of the i18n migration there is no app/layout.tsx, so any
// global styling (Tailwind, design tokens) has to be loaded here too.
import '../globals.css'

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
      <body>{children}</body>
    </html>
  )
}
