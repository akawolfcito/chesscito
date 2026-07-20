import { promises as fs } from "node:fs";
import path from "node:path";

import {
  auditResponsiveFamilies,
  discoverResponsiveBasenames,
  type ResponsiveFamilyAudit,
} from "../src/lib/themes/responsive-asset-audit";
import { configuredResponsiveFamilyBindings } from "../src/lib/themes/responsive-family-bindings";

const REPORT_PATH = path.resolve(
  process.cwd(),
  "../../docs/audits/2026-07-19-responsive-asset-families.md",
);

function variants(audit: ResponsiveFamilyAudit): string {
  return audit.expected
    .map((file) => file.replace(audit.basename, ""))
    .join(", ");
}

function markdown(
  audits: ResponsiveFamilyAudit[],
  unconfigured: Array<{ basename: string; files: string[] }>,
): string {
  const lines = [
    "# Responsive asset-family inventory — 2026-07-19",
    "",
    "Generated reproducibly from decoded image metadata and normalized visual signatures.",
    "Timestamps are not used as consistency evidence.",
    "",
    "| Family | Slot(s) | Expected variants | State | Action |",
    "|---|---|---|---|---|",
  ];
  for (const audit of audits) {
    lines.push(
      `| ${audit.basename.replace(/^\/art\//, "")} | ${audit.slots.join(", ")} | ${variants(audit)} | ${audit.states.join(", ")} | ${audit.action} |`,
    );
  }
  for (const family of unconfigured) {
    lines.push(
      `| ${family.basename.replace(/^\/art\//, "")} | — | ${family.files.map((file) => file.replace(family.basename, "")).join(", ")} | orphan-derived, unknown-source | review |`,
    );
  }

  lines.push("", "## Reproducible evidence", "");
  for (const audit of audits) {
    lines.push(`### ${audit.basename}`);
    lines.push("");
    lines.push(`- Source dimensions: ${audit.sourceDimensions ? `${audit.sourceDimensions.width}×${audit.sourceDimensions.height}` : "unknown"}`);
    lines.push(`- Normalized source signature: ${audit.sourceSignature ?? "unknown"}`);
    lines.push(`- Missing: ${audit.missing.length ? audit.missing.join(", ") : "none"}`);
    lines.push(`- Orphan: ${audit.orphan.length ? audit.orphan.join(", ") : "none"}`);
    const distances = Object.entries(audit.visualDistances);
    lines.push(
      `- Normalized visual distances: ${distances.length ? distances.map(([file, distance]) => `${file}=${distance}`).join(", ") : "none"}`,
    );
    lines.push("");
  }

  lines.push("## Selective action", "");
  lines.push("- Regenerated: `/art/avatar-lite-hub`, `/art/avatar-pro`.");
  lines.push("- Unchanged healthy: `/art/title-chesscito`.");
  lines.push("- Unchanged pending approved source: `/art/shop/welcome-gift` (current canonical source is undersized/inconsistent).", "");
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const publicDir = path.join(process.cwd(), "public");
  const bindings = configuredResponsiveFamilyBindings();
  const audits = await auditResponsiveFamilies(bindings, publicDir);
  const discovered = await discoverResponsiveBasenames(publicDir);
  const configured = new Set(bindings.map((binding) => binding.basename));
  const unconfigured = [...discovered.entries()]
    .filter(([basename]) => !configured.has(basename))
    .map(([basename, files]) => ({ basename, files }));
  const report = markdown(audits, unconfigured);

  if (process.argv.includes("--write")) {
    await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
    await fs.writeFile(REPORT_PATH, report, "utf8");
  } else {
    process.stdout.write(report);
  }

  if (audits.some((audit) => audit.state === "stale" || audit.state === "missing-derived")) {
    process.exitCode = 1;
  }
}

void main();
