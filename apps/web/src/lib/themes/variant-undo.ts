import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ResolvedVariant } from "./asset-variant";

export type VariantUndo = {
  previous: ResolvedVariant;
  basename?: string;
  restoreTriplet: boolean;
  restoreRegistry: boolean;
};

const UNDO_DIR = path.join(process.cwd(), ".theme-builder-trash", "variant-state");

function undoFile(themeId: string, key: string, variant: "default" | "pro"): string {
  const name = [themeId, key, variant].map(encodeURIComponent).join("--");
  return path.join(UNDO_DIR, `${name}.json`);
}

export async function saveVariantUndo(
  themeId: string,
  key: string,
  variant: "default" | "pro",
  undo: VariantUndo,
): Promise<void> {
  await fs.mkdir(UNDO_DIR, { recursive: true });
  await fs.writeFile(undoFile(themeId, key, variant), JSON.stringify(undo), "utf8");
}

export async function readVariantUndo(
  themeId: string,
  key: string,
  variant: "default" | "pro",
): Promise<VariantUndo | null> {
  try {
    return JSON.parse(
      await fs.readFile(undoFile(themeId, key, variant), "utf8"),
    ) as VariantUndo;
  } catch {
    return null;
  }
}

export async function hasVariantUndo(
  themeId: string,
  key: string,
  variant: "default" | "pro",
): Promise<boolean> {
  try {
    await fs.access(undoFile(themeId, key, variant));
    return true;
  } catch {
    return false;
  }
}
