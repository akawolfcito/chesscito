import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AssetVariant } from "./asset-variant";
import { updateRegistrySource } from "./registry-source";

const REGISTRY_FILE = path.join(process.cwd(), "src/lib/themes/theme-registry.ts");

export async function setRegistryVariant(
  themeId: string,
  key: string,
  variant: "default" | "pro",
  value: AssetVariant,
): Promise<void> {
  const source = await fs.readFile(REGISTRY_FILE, "utf8");
  const updated = updateRegistrySource(source, themeId, key, variant, value);
  if (updated === source) return;

  const temp = `${REGISTRY_FILE}.theme-builder.tmp`;
  await fs.writeFile(temp, updated, "utf8");
  await fs.rename(temp, REGISTRY_FILE);
}
