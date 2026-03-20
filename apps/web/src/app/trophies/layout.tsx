import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trophy Vitrine — Chesscito",
  description: "Your onchain victories, immortalized.",
};

export default function TrophiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
