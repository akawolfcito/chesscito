import { NextResponse } from "next/server";
import { getHallOfFame } from "@/lib/server/hof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await getHallOfFame();
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Failed to fetch hall of fame" }, { status: 500 });
  }
}
