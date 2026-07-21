import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/20260630120000_get_peones_treasury_canary_foundation.sql"),
  "utf8",
);
const lifecycleMigration = fs.readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/20260720000000_get_peones_intent_lifecycle.sql"),
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

  it("adds and constrains the explicit persisted lifecycle", () => {
    expect(lifecycleMigration).toContain("lifecycle_status");
    for (const lifecycle of [
      "CREATED", "SUBMITTING", "SUBMITTED", "CONFIRMED",
      "CANCELLED", "FAILED", "EXPIRED", "REVERTED",
    ]) expect(lifecycleMigration).toContain(`'${lifecycle}'`);
    expect(lifecycleMigration).toMatch(/SUBMITTED', 'CONFIRMED', 'REVERTED'[\s\S]*tx_hash is not null/i);
  });

  it("drops the old immutable trigger before backfill and recreates it afterward", () => {
    const dropAt = lifecycleMigration.indexOf("drop trigger if exists treasury_payment_intents_immutable");
    const backfillAt = lifecycleMigration.indexOf("update public.treasury_payment_intents");
    const recreateAt = lifecycleMigration.lastIndexOf("create trigger treasury_payment_intents_immutable");
    expect(dropAt).toBeGreaterThan(-1);
    expect(dropAt).toBeLessThan(backfillAt);
    expect(recreateAt).toBeGreaterThan(backfillAt);
  });

  it("backfills already consumed intents as confirmed with their canonical hash", () => {
    expect(lifecycleMigration).toMatch(/from public\.treasury_payment_consumptions as consumption/i);
    expect(lifecycleMigration).toMatch(/lifecycle_status = 'CONFIRMED'[\s\S]*tx_hash = lower\(consumption\.tx_hash\)/i);
  });

  it("keeps pre-migration unconsumed intents ambiguous instead of retry-safe", () => {
    expect(lifecycleMigration).toMatch(
      /PRE_MIGRATION_STATE_UNKNOWN[\s\S]*retry_safe = false[\s\S]*not exists/i,
    );
    expect(lifecycleMigration).toMatch(/PRE_MIGRATION_HASH_UNVERIFIED/i);
    expect(lifecycleMigration).toMatch(/Historical warning logs are not stored/i);
  });

  it("serializes creation on the commercial identity across processes", () => {
    const creationMigration = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/migrations/20260720010000_get_peones_intent_creation_lock.sql"),
      "utf8",
    );
    expect(creationMigration).toMatch(/pg_advisory_xact_lock/i);
    expect(creationMigration).toMatch(/wallet[\s\S]*sku[\s\S]*chain_id[\s\S]*config_version/i);
    expect(creationMigration).toMatch(/before insert/i);
    expect(creationMigration).toMatch(/active_get_peones_intent_exists/i);
    expect(creationMigration).toMatch(/create_get_peones_intent/i);
  });

  it("ships representative legacy backfill and concurrent-request fixtures", () => {
    const backfillFixture = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/tests/get_peones_intent_lifecycle_backfill.sql"),
      "utf8",
    );
    const concurrencyFixture = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/tests/get_peones_intent_creation_concurrency.sql"),
      "utf8",
    );
    const legacyFixture = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/tests/get_peones_intent_legacy_insert_concurrency.sql"),
      "utf8",
    );
    expect(backfillFixture).toMatch(/consumed fixture/i);
    expect(backfillFixture).toMatch(/tx_hash is null/i);
    expect(backfillFixture).toMatch(/PRE_MIGRATION_HASH_UNVERIFIED/i);
    expect(concurrencyFixture).toMatch(/pgbench/i);
    expect(concurrencyFixture).toMatch(/create_get_peones_intent/i);
    expect(legacyFixture).toMatch(/insert into public\.treasury_payment_intents/i);
    expect(legacyFixture).toMatch(/:client_id/i);
  });

  it("lets canonical verifier evidence replace only unresolved candidate hashes", () => {
    expect(lifecycleMigration).toMatch(
      /old\.lifecycle_status in \('CREATED', 'SUBMITTING', 'SUBMITTED', 'CANCELLED', 'FAILED'\)[\s\S]*new\.lifecycle_status in \('SUBMITTED', 'REVERTED'\)/i,
    );
  });

  it("ships a service-role-only, append-only legacy resolution path", () => {
    const resolutionMigration = fs.readFileSync(
      path.resolve(process.cwd(), "supabase/migrations/20260721000000_get_peones_legacy_resolution.sql"),
      "utf8",
    );
    const audit = fs.readFileSync(
      path.resolve(process.cwd(), "../../docs/audits/get-peones-intent-lifecycle-audit.sql"),
      "utf8",
    );
    const runbook = fs.readFileSync(
      path.resolve(process.cwd(), "../../docs/audits/get-peones-legacy-resolution.sql"),
      "utf8",
    );
    expect(resolutionMigration).toMatch(/treasury_payment_intent_resolutions/i);
    expect(resolutionMigration).toMatch(/target.lifecycle_status not in \('CREATED', 'SUBMITTING'\)/i);
    expect(resolutionMigration).toMatch(/target.tx_hash is not null/i);
    expect(resolutionMigration).toMatch(/treasury_payment_consumptions c where c.intent_id = target.id/i);
    expect(resolutionMigration).toMatch(/revoke all on function public.resolve_get_peones_legacy_intent/i);
    expect(resolutionMigration).toMatch(/grant execute on function public.resolve_get_peones_legacy_intent[\s\S]*to service_role/i);
    expect(audit).toMatch(/date_trunc\('day', i\.created_at\)/i);
    expect(runbook).toMatch(/treasury_payment_intent_resolutions/i);
    expect(audit).not.toMatch(/select date_trunc\('day', created_at\)/i);
  });
});
