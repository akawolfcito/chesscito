import { NextResponse } from "next/server";
import type { LabyrinthRecord } from "@/lib/labyrinth-builder/store";
import type { ContentBucket } from "@/lib/content/overlay-types";
import {
  readBaselineRecords,
  writeBaselineRecord,
  type KindedRecord,
} from "@/lib/content/baseline-write";
import { canWriteBaseline, isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isDevSurfaceEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }
  const filter = new URL(req.url).searchParams.get("kind");
  const kind: ContentBucket | undefined =
    filter === "exercise" || filter === "labyrinth" ? filter : undefined;
  // `canWrite` is the server telling the builder what the SERVER can do: the
  // builder is a client component and cannot read process.env.VERCEL itself. On
  // a deploy the fs is read-only, so Save must render disabled with a reason
  // rather than fire a 500 out of writeFileSync (spec behavior 15).
  return NextResponse.json({
    ok: true,
    records: readBaselineRecords(kind),
    canWrite: canWriteBaseline(),
  });
}

export async function POST(req: Request) {
  if (!isDevSurfaceEnabled()) {
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
  const kind: ContentBucket = body.kind === "exercise" ? "exercise" : "labyrinth";
  const { kind: _kind, ...rec } = body;

  const result = writeBaselineRecord(kind, rec as LabyrinthRecord);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 400 });
  }
  // `rec` was mutated in place to carry the resolved id.
  return NextResponse.json({ ok: true, saved: rec, warnings: result.warnings });
}
