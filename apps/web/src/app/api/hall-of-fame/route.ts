import { NextResponse } from "next/server";

import { getHallOfFame } from "@/lib/server/hof-blockscout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getHallOfFame();

  return NextResponse.json(rows, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=120",
    },
  });
}
