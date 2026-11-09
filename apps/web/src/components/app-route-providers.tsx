"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnalyticsBoot } from "@/components/analytics/analytics-boot";
import { ThemeCssVariables } from "@/components/themes/theme-css-variables";
import { WalletProviderBoundary } from "@/components/wallet-provider-boundary";
import { routing } from "@/i18n/routing";

function isPublicLegalPath(pathname: string | null): boolean {
  if (!pathname) return false;
  let path = pathname;
  for (const locale of routing.locales) {
    if (path.startsWith(`/${locale}/`)) {
      path = path.slice(locale.length + 1);
      break;
    }
  }
  return ["/privacy", "/terms", "/support"].some(
    (route) => path === route || path === `${route}/`,
  );
}

/** Existing legal pages must be readable before wallet loading or login.
 * Keep their SSR content outside wallet-scoped contexts and analytics boot.
 * All other routes retain the existing provider tree and access gate. */
export function AppRouteProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isPublicLegalPath(pathname)) return <>{children}</>;

  return (
    <WalletProviderBoundary>
      <ThemeCssVariables />
      <AnalyticsBoot />
      {children}
    </WalletProviderBoundary>
  );
}
