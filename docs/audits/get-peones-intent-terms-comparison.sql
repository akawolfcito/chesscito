-- Read-only comparison of the last confirmed Get Peones intent and the
-- current ambiguous MiniPay submission. Deliberately excludes wallet and
-- transaction hash columns.
select i.id as intent_id,
       i.token_address,
       i.token_symbol,
       i.token_decimals,
       i.expected_amount,
       i.treasury_address,
       i.chain_id,
       i.config_version,
       i.price_version,
       i.required_confirmations
  from public.treasury_payment_intents as i
 where i.id in (
   '70015888-53f3-444d-b76c-dba2be3ac7ec'::uuid,
   '6940d35d-82c9-441b-9d0d-0f3d5a25e6aa'::uuid
 )
 order by i.created_at;
