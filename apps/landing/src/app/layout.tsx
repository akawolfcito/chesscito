import type { Metadata, Viewport } from "next";
import { Fredoka, Rowdies } from "next/font/google";
import "./globals.css";
import { LANDING_COPY } from "@/lib/content/editorial";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

const rowdies = Rowdies({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-rowdies",
  display: "swap",
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.chesscito.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: LANDING_COPY.meta.title,
  description: LANDING_COPY.meta.description,
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: LANDING_COPY.meta.title,
    description: LANDING_COPY.meta.description,
    url: BASE_URL,
    images: [{ url: "/og/chesscito-landing.jpg", width: 1200, height: 630, type: "image/jpeg" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: LANDING_COPY.meta.title,
    description: LANDING_COPY.meta.description,
    images: ["/og/chesscito-landing.jpg"],
  },
  other: {
    "talentapp:project_verification":
      "24912a54c2fbb019a7fd89ea904c1355dc572b6f955d4146c3078576fb4c77513b57c9f59e765b9fc63400005bcb9948f88b266c8862be94aef6d2adbf8473ee",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6e6b8",
  // Ported from apps/web — disables double-tap-to-zoom and pinch-zoom so
  // an errant double-tap while advancing onboarding slides doesn't zoom
  // the page. Low-vision users retain OS-level zoom above the browser.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${rowdies.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
