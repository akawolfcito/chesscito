import { getSupabaseServer } from "@/lib/supabase/server";
import { readSpendBearerToken, resolveSpendSessionWallet } from "@/lib/scores/spend-session-guard";
import { resolveDeploymentSurface } from "@/lib/scores/deployment-surface";

/** Reuse the wallet's existing, revocable session for off-chain gameplay. */
export async function authorizeGameplaySession(req: Request, wallet: string): Promise<boolean> {
  const token = readSpendBearerToken(req);
  if (!token) return false;
  try {
    const client = getSupabaseServer({ freshReads: true });
    if (!client) return false;
    const session = await resolveSpendSessionWallet(client, token, Date.now());
    return session.status === "ok" && session.wallet === wallet.toLowerCase() &&
      session.surface === resolveDeploymentSurface();
  } catch { return false; }
}
