import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), "../../.github/workflows/cron-stats-snapshot-refresh.yml"),
  "utf8",
);

describe("stats refresh workflow response capture", () => {
  it("keeps the request deadline and job timeout while capturing status and a bounded body", () => {
    expect(workflow).toContain("timeout-minutes: 3");
    expect(workflow).toContain("--max-time 120");
    expect(workflow).toContain("--write-out '%{http_code}'");
    expect(workflow).toContain("--output \"$response_file\"");
    expect(workflow).toContain('read(4096)');
    expect(workflow).toContain('body.replace(secret, "[REDACTED]")');
    expect(workflow).toContain('sys.stdout.write(body[:4096])');

    expect(workflow).toMatch(/if \[\[ ! "\$http_status" =~ \^2\[0-9\]\{2\}\$ \]\]; then[\s\S]*?Response body \(max 4 KB\)/);
    expect(workflow).not.toMatch(/curl[^\n]*--fail/);
    expect(workflow).not.toMatch(/--include|--dump-header|--verbose/);
  });

  it("never prints request headers or the configured refresh secret", () => {
    expect(workflow).toContain('"Authorization: Bearer ${STATS_REFRESH_SECRET}"');
    expect(workflow).not.toMatch(/echo[^\n]*Authorization/);
    expect(workflow).not.toMatch(/printf[^\n]*STATS_REFRESH_SECRET/);
  });
});
