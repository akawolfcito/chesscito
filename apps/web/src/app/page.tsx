import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PlayHubRoot } from "@/components/play-hub/play-hub-root";
import { detectWalletFromUserAgent } from "@/lib/server/wallet-detection";

/**
 * `/` — server component that decides between the public landing and
 * the play hub based on whether the visitor is inside a wallet
 * WebView (MiniPay / Valora / Coinbase / Trust).
 *
 * Wallet visitors are redirected to `/hub` (canonical play-hub URL)
 * so existing bookmarks keep dropping them inside the game without
 * a flash of marketing content. Web visitors fall through to the
 * landing.
 *
 * Transitional state for this commit: the non-wallet path still
 * renders <PlayHubRoot /> until the new responsive landing lands in
 * the next commit. The redirect path is wired and verified now so
 * the production switchover in the landing commit is a content swap,
 * not a routing change.
 */
export default function HomePage() {
  const ua = headers().get("user-agent");
  const wallet = detectWalletFromUserAgent(ua);
  if (wallet) {
    redirect("/hub");
  }
  return <PlayHubRoot />;
}
