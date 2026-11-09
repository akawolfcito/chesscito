-- pgbench fixture for a non-production database only.
-- Run with 8 clients against a disposable Supabase test database:
-- pgbench -n -c 8 -j 8 -t 1 -f this-file "$SUPABASE_TEST_DATABASE_URL"
-- Then assert that the commercial identity has one active row and every
-- result returned the same intent JSON. This fixture never submits a payment.

with result as (
  select * from public.create_get_peones_intent(
  '00000000-0000-4000-8000-000000000099'::uuid,
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'peones_pack_50',
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e',
  'USDT', 6, 500000, 42220,
  '0x1234567890abcdef1234567890abcdef12345678',
  'canary-v1', 'peones-50-v1', 2, 'client_asserted_wallet',
  now() + interval '10 minutes'
  )
)
insert into public.get_peones_creation_test_results(run_id, intent, created)
select 'pgbench-local-1', intent, created from result;
