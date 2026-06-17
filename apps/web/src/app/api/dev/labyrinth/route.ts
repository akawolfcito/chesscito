import { NextResponse } from "next/server";
import type { LabyrinthRecord } from "@/lib/labyrinth-builder/store";
import type { ContentKind } from "@/lib/content/overlay-types";
import {
  readBaselineRecords,
  writeBaselineRecord,
  type KindedRecord,
} from "@/lib/content/baseline-write";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  const filter = new URL(req.url).searchParams.get("kind");
  const kind: ContentKind | undefined =
    filter === "exercise" || filter === "labyrinth" ? filter : undefined;
  return NextResponse.json({ ok: true, records: readBaselineRecords(kind) });
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  let body: KindedRecord;
  try {
    body = (await req.json()) as KindedRecord;
  } catch {
    return NextResponse.json({ ok: false, errors: ["invalid JSON"] }, { status: 400 });
  }
  // `kind` selects the bucket (default "labyrinth" for back-compat); it is not
  // persisted — the file the record lands in implies it.
  const kind: ContentKind = body.kind === "exercise" ? "exercise" : "labyrinth";
  const { kind: _kind, ...rec } = body;

  const result = writeBaselineRecord(kind, rec as LabyrinthRecord);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 400 });
  }
  // `rec` was mutated in place to carry the resolved id.
  return NextResponse.json({ ok: true, saved: rec, warnings: result.warnings });
}
