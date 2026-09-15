import { redirect } from "next/navigation";

export const metadata = {
  title: "Platform Stats — Chesscito",
  description: "Public activity metrics for Chesscito on Celo.",
  robots: { index: false, follow: false },
};

export default async function StatsRoute({
  params,
}: {
  params: { locale: string };
}) {
  // Containment: this app never computes public stats. Preserve locale only;
  // landing owns the one durable all/all snapshot and marks filters unavailable.
  return redirect(`https://www.chesscito.com/stats${params.locale === "es" ? "?locale=es" : ""}`);
}
