import { notFound } from "next/navigation";

import { CoachHistoryFixture } from "./fixture";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

export default function CoachHistoryDevPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const credits =
    typeof searchParams.credits === "string"
      ? Math.max(0, Number.parseInt(searchParams.credits, 10) || 0)
      : 3;

  return <CoachHistoryFixture credits={credits} />;
}
