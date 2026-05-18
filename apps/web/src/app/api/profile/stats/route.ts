import { NextResponse } from "next/server";
import { getProfileStats } from "@/lib/supabase/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "missing address param" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { error: "malformed address" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const stats = await getProfileStats(address.toLowerCase() as `0x${string}`);
    return NextResponse.json(stats, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[/api/profile/stats] failed", error);
    return NextResponse.json(
      { error: "internal" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
