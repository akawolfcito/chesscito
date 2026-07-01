import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/20260630120000_get_peones_treasury_canary_foundation.sql"),
  "utf8",
);

describe("Get Peones Treasury canary persistence", () => {
  it("defines one global source-independent payment identity", () => {
    expect(migration).toMatch(/unique \(chain_id, tx_hash, log_index\)/i);
    expect(migration).toContain("treasury_payment_consumptions");
  });

  it("atomically consumes and credits exactly 50 Peones", () => {
    expect(migration).toContain("consume_get_peones_treasury_payment");
    expect(migration).toMatch(/insert into public\.treasury_payment_consumptions[\s\S]*insert into public\.peones_ledger/i);
    expect(migration).toMatch(/'earn', 50, 'pack_purchase', 'peones_pack_50'/i);
  });

  it("shares the same global identity across canary, legacy Peones and Season Pass", () => {
    expect(migration).toContain("consume_get_peones_treasury_payment");
    expect(migration).toContain("consume_legacy_get_peones_payment");
    expect(migration).toContain("consume_lite_season_pass_payment");
    expect(migration.match(/insert into public\.treasury_payment_consumptions/gi)).toHaveLength(3);
    expect(migration).toMatch(/product\s+text\s+not null/i);
    expect(migration).not.toMatch(/unique\s*\(source[^)]*chain_id/i);
  });

  it("makes each entitlement insert atomic with global consumption", () => {
    expect(migration).toMatch(/consume_legacy_get_peones_payment[\s\S]*insert into public\.treasury_payment_consumptions[\s\S]*insert into public\.peones_ledger/i);
    expect(migration).toMatch(/consume_lite_season_pass_payment[\s\S]*insert into public\.treasury_payment_consumptions[\s\S]*insert into public\.lite_season_passes/i);
  });

  it("does not source-prefix the global identity", () => {
    expect(migration).toMatch(/where chain_id = p_chain_id[\s\S]*tx_hash = lower\(p_tx_hash\)[\s\S]*log_index = p_log_index/i);
  });
});
