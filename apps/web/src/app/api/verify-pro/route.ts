import { NextResponse } from "next/server";

/** PRO sales are paused; this endpoint never grants or extends access. */
export async function POST(_req: Request) {
  return NextResponse.json({ error: "pro_sales_paused" }, { status: 403 });
}
