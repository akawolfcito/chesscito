import { NextResponse } from "next/server";
import type { LabyrinthRecord } from "@/lib/labyrinth-builder/store";
import type { ContentBucket } from "@/lib/content/overlay-types";
import {
  readBaselineRecords,
  writeBaselineRecord,
  type BucketedRecord,
} from "@/lib/content/baseline-write";
import { canWriteBaseline, isDevSurfaceEnabled } from "@/lib/dev/dev-surface";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isDevSurfaceEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }
  // `?bucket=` selects the FILE, not the game. It used to be `?kind=`, which
  // read as "give me the queens levels" and meant "give me labyrinths.json" —
  // and the response now carries each record's real `kind`, so the two names
  // would actively contradict each other.
  const filter = new URL(req.url).searchParams.get("bucket");
  const bucket: ContentBucket | undefined =
    filter === "exercise" || filter === "labyrinth" ? filter : undefined;
  // `canWrite` is the server telling the builder what the SERVER can do: the
  // builder is a client component and cannot read process.env.VERCEL itself. On
  // a deploy the fs is read-only, so Save must render disabled with a reason
  // rather than fire a 500 out of writeFileSync (spec behavior 15).
  return NextResponse.json({
    ok: true,
    records: readBaselineRecords(bucket),
    canWrite: canWriteBaseline(),
  });
}

export async function POST(req: Request) {
  if (!isDevSurfaceEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }
  let body: Partial<BucketedRecord>;
  try {
    body = (await req.json()) as Partial<BucketedRecord>;
  } catch {
    return NextResponse.json({ ok: false, errors: ["invalid JSON"] }, { status: 400 });
  }
  // `bucket` selects the file (default "labyrinth" for back-compat) and is not
  // persisted — the file the record lands in implies it. The record's own
  // `kind` is left ALONE: it rides through to disk, which is the whole point.
  const bucket: ContentBucket = body.bucket === "exercise" ? "exercise" : "labyrinth";
  const { bucket: _bucket, ...rec } = body;

  const result = writeBaselineRecord(bucket, rec as LabyrinthRecord);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 400 });
  }
  // The id may have been auto-assigned on write; take it from the result rather
  // than from `rec` (the writer no longer mutates its input).
  return NextResponse.json({
    ok: true,
    saved: { ...rec, id: result.id },
    warnings: result.warnings,
  });
}
