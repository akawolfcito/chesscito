-- Duelo p2p — smoke de comportamiento de la tabla `duels`.
--
-- El guard de vitest (src/lib/duel/__tests__/duels-schema.test.ts) sólo puede
-- afirmar que el TEXTO de la migración dice algo. ESTE archivo prueba que la
-- base lo hace: cada constraint se ejercita rompiéndolo a propósito.
--
-- Run (Postgres efímero, sin dejar contenedor ni volumen):
--   docker run --rm -d --name pg-duels -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16-alpine
--   psql "$PG" -c "create role anon nologin; create role authenticated nologin;"
--   psql "$PG" -f supabase/migrations/20260814120000_p2p_duels.sql
--   psql "$PG" -f supabase/tests/duels_smoke.sql
--   docker rm -f pg-duels
--
-- ⚠️ El `create role` de la primera línea NO es parte del esquema: `anon` y
-- `authenticated` vienen de fábrica en Supabase y NO existen en un Postgres
-- pelado, así que sin ellos el `revoke` de la migración corta con
-- `role "anon" does not exist`. Con `supabase db reset` no hace falta.
--
-- ⛔ Verificado el 2026-08-14 por mutación, que es lo único que prueba que un
-- smoke muerde: sacándole a la tabla `duels_initial_minutes_check` y
-- `duels_expired_never_had_two_players`, los casos 3 y 6 se pusieron rojos.
--
-- Todo corre en UNA transacción y termina en ROLLBACK, así que es repetible y
-- no persiste ni filas ni roles. Una aserción fallida RAISEa y aborta; el éxito
-- imprime 'DUELS SMOKE — ALL PASSED'.

begin;

-- Un helper: ejecuta `stmt` y RAISEa si NO falló. Vive en pg_temp, así que se
-- va con la sesión.
create or replace function pg_temp.expect_fail(stmt text, label text)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception
    when check_violation or not_null_violation or unique_violation then
      return;  -- falló como debía
  end;
  raise exception 'ESPERABA UN RECHAZO Y PASÓ: %', label;
end;
$$;

do $$
declare
  ok_id    text := repeat('A', 22);
  id2      text := repeat('B', 22);
  hash_w   text := repeat('a', 64);
  hash_b   text := repeat('b', 64);
  v_cnt    int;
  v_purged int;
begin
  -- ── Caso 1: el duelo recién creado, con el creador sentado ─────────
  insert into public.duels (
    id, status, white_token_hash, white_claimed_at,
    white_remaining_ms, black_remaining_ms,
    fen, expires_at, initial_minutes, invited_by
  ) values (
    ok_id, 'awaiting-opponent', hash_w, now(),
    600000, 600000,
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    now() + interval '1 hour', 10, 'server:creator'
  );
  select count(*) into v_cnt from public.duels where id = ok_id;
  if v_cnt <> 1 then raise exception 'Caso1: no se insertó el duelo válido'; end if;

  -- ── Caso 2: el id no puede ser algo que se adivine contando ────────
  perform pg_temp.expect_fail($q$
    insert into public.duels (id, status, white_token_hash, white_claimed_at,
      white_remaining_ms, black_remaining_ms, fen, expires_at, initial_minutes)
    values ('duel-1', 'awaiting-opponent', repeat('a',64), now(),
      600000, 600000, 'x', now() + interval '1 hour', 10)
  $q$, 'Caso2: id enumerable');

  -- ── Caso 3: la escalera admite SIETE valores y ninguno más ─────────
  perform pg_temp.expect_fail($q$
    insert into public.duels (id, status, white_token_hash, white_claimed_at,
      white_remaining_ms, black_remaining_ms, fen, expires_at, initial_minutes)
    values (repeat('C',22), 'awaiting-opponent', repeat('a',64), now(),
      600000, 600000, 'x', now() + interval '1 hour', 7)
  $q$, 'Caso3: 7 minutos no está en la escalera');

  -- Y los siete sí entran, incluido el 0.5 de los 30 segundos.
  insert into public.duels (id, status, white_token_hash, white_claimed_at,
    white_remaining_ms, black_remaining_ms, fen, expires_at, initial_minutes)
  select repeat('D',21) || chr((65 + i)::int), 'awaiting-opponent', repeat('a',64), now(),
    600000, 600000, 'x', now() + interval '1 hour', m
  from unnest(array[0.5, 1, 3, 5, 10, 15, 30]::numeric[]) with ordinality as t(m, i);
  select count(*) into v_cnt from public.duels where id like repeat('D',21) || '%';
  if v_cnt <> 7 then raise exception 'Caso3: la escalera rechazó uno de los suyos (%)', v_cnt; end if;

  -- ── Caso 4: `active` exige DOS asientos y un sello de reloj ────────
  perform pg_temp.expect_fail($q$
    insert into public.duels (id, status, white_token_hash, white_claimed_at,
      white_remaining_ms, black_remaining_ms, fen, expires_at, initial_minutes, last_move_at)
    values (repeat('E',22), 'active', repeat('a',64), now(),
      600000, 600000, 'x', now() + interval '1 hour', 10, now())
  $q$, 'Caso4a: active con un solo asiento');

  perform pg_temp.expect_fail($q$
    insert into public.duels (id, status, white_token_hash, white_claimed_at,
      black_token_hash, black_claimed_at,
      white_remaining_ms, black_remaining_ms, fen, expires_at, initial_minutes)
    values (repeat('F',22), 'active', repeat('a',64), now(), repeat('b',64), now(),
      600000, 600000, 'x', now() + interval '1 hour', 10)
  $q$, 'Caso4b: active sin last_move_at — el reloj no tendría contra qué correr');

  -- ── Caso 5: terminado ⇔ hay resultado ──────────────────────────────
  perform pg_temp.expect_fail($q$
    insert into public.duels (id, status, white_token_hash, white_claimed_at,
      black_token_hash, black_claimed_at,
      white_remaining_ms, black_remaining_ms, fen, expires_at, initial_minutes, last_move_at)
    values (repeat('G',22), 'finished', repeat('a',64), now(), repeat('b',64), now(),
      600000, 600000, 'x', now() + interval '1 hour', 10, now())
  $q$, 'Caso5a: finished sin outcome');

  perform pg_temp.expect_fail($q$
    insert into public.duels (id, status, white_token_hash, white_claimed_at,
      white_remaining_ms, black_remaining_ms, fen, expires_at, initial_minutes, outcome)
    values (repeat('H',22), 'awaiting-opponent', repeat('a',64), now(),
      600000, 600000, 'x', now() + interval '1 hour', 10,
      '{"kind":"checkmate","winner":"w"}'::jsonb)
  $q$, 'Caso5b: outcome sin haber terminado');

  perform pg_temp.expect_fail($q$
    insert into public.duels (id, status, white_token_hash, white_claimed_at,
      black_token_hash, black_claimed_at,
      white_remaining_ms, black_remaining_ms, fen, expires_at, initial_minutes,
      last_move_at, outcome)
    values (repeat('I',22), 'finished', repeat('a',64), now(), repeat('b',64), now(),
      600000, 600000, 'x', now() + interval '1 hour', 10, now(),
      '{"kind":"abandoned","winner":"w"}'::jsonb)
  $q$, 'Caso5c: `abandoned` ya no existe — lo reemplazó timeout');

  -- ── Caso 6: `expired` es SÓLO el enlace que nadie contestó ─────────
  -- Sin esto, una ruta podría escribir `expired` encima de una partida viva y
  -- borrar una victoria por bandera sin que nada se queje.
  perform pg_temp.expect_fail($q$
    insert into public.duels (id, status, white_token_hash, white_claimed_at,
      black_token_hash, black_claimed_at,
      white_remaining_ms, black_remaining_ms, fen, expires_at, initial_minutes, last_move_at)
    values (repeat('J',22), 'expired', repeat('a',64), now(), repeat('b',64), now(),
      600000, 600000, 'x', now() - interval '1 hour', 10, now())
  $q$, 'Caso6: expired con los dos asientos ocupados');

  -- ── Caso 7: un duelo sin nadie no existe ───────────────────────────
  perform pg_temp.expect_fail($q$
    insert into public.duels (id, status,
      white_remaining_ms, black_remaining_ms, fen, expires_at, initial_minutes)
    values (repeat('K',22), 'awaiting-opponent',
      600000, 600000, 'x', now() + interval '1 hour', 10)
  $q$, 'Caso7: ningún asiento reclamado');

  -- ── Caso 8: el asiento libre no lleva sello, y el ocupado sí ───────
  perform pg_temp.expect_fail($q$
    insert into public.duels (id, status, white_token_hash,
      white_remaining_ms, black_remaining_ms, fen, expires_at, initial_minutes)
    values (repeat('L',22), 'awaiting-opponent', repeat('a',64),
      600000, 600000, 'x', now() + interval '1 hour', 10)
  $q$, 'Caso8: credencial sin claimed_at');

  -- ── Caso 9: forma del hash, banco negativo y nombre largo ──────────
  perform pg_temp.expect_fail($q$
    insert into public.duels (id, status, white_token_hash, white_claimed_at,
      white_remaining_ms, black_remaining_ms, fen, expires_at, initial_minutes)
    values (repeat('M',22), 'awaiting-opponent', 'no-es-un-sha256', now(),
      600000, 600000, 'x', now() + interval '1 hour', 10)
  $q$, 'Caso9a: token_hash con forma inválida');

  perform pg_temp.expect_fail($q$
    insert into public.duels (id, status, white_token_hash, white_claimed_at,
      white_remaining_ms, black_remaining_ms, fen, expires_at, initial_minutes)
    values (repeat('N',22), 'awaiting-opponent', repeat('a',64), now(),
      -1, 600000, 'x', now() + interval '1 hour', 10)
  $q$, 'Caso9b: banco de tiempo negativo');

  perform pg_temp.expect_fail($q$
    insert into public.duels (id, status, white_token_hash, white_claimed_at,
      white_display_name,
      white_remaining_ms, black_remaining_ms, fen, expires_at, initial_minutes)
    values (repeat('O',22), 'awaiting-opponent', repeat('a',64), now(),
      repeat('x', 25),
      600000, 600000, 'x', now() + interval '1 hour', 10)
  $q$, 'Caso9c: displayName de más de 24');

  -- ── Caso 10: el CAS sobre `version` ────────────────────────────────
  update public.duels set version = version + 1, fen = 'movido'
   where id = ok_id and version = 1;
  get diagnostics v_cnt = row_count;
  if v_cnt <> 1 then raise exception 'Caso10: el CAS con la versión correcta no aplicó'; end if;

  update public.duels set version = version + 1, fen = 'pisado'
   where id = ok_id and version = 1;
  get diagnostics v_cnt = row_count;
  if v_cnt <> 0 then raise exception 'Caso10: el CAS aplicó con una versión vieja'; end if;

  -- ── Caso 11: los dos bancos pueden ser distintos (el handicap) ─────
  insert into public.duels (id, status, white_token_hash, white_claimed_at,
    black_token_hash, black_claimed_at,
    white_remaining_ms, black_remaining_ms, fen, expires_at, initial_minutes, last_move_at)
  values (id2, 'active', hash_w, now(), hash_b, now(),
    600000, 60000, 'x', now() + interval '1 hour', 10, now());
  select count(*) into v_cnt from public.duels
   where id = id2 and white_remaining_ms <> black_remaining_ms;
  if v_cnt <> 1 then raise exception 'Caso11: la tabla no admite bancos distintos'; end if;

  -- ── Caso 12: la purga barre lo viejo y no toca lo vivo ─────────────
  update public.duels set created_at = now() - interval '30 days' where id = id2;
  select public.purge_duels() into v_purged;
  if v_purged <> 1 then raise exception 'Caso12: la purga borró % filas, esperaba 1', v_purged; end if;
  select count(*) into v_cnt from public.duels where id = ok_id;
  if v_cnt <> 1 then raise exception 'Caso12: la purga se llevó un duelo vivo'; end if;

  raise notice 'DUELS SMOKE — ALL PASSED';
end;
$$;

-- ── Caso 13: RLS — que anon NO pueda leer la tabla ───────────────────
-- ⚠️ Esto se verifica CORRIÉNDOLO con `set role`, no leyendo el header de la
-- migración: existe una migración en este repo (20260806010000) precisamente
-- porque otra AFIRMABA tener RLS sin haberla ejecutado nunca.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end;
$$;

do $$
begin
  set local role anon;
  begin
    perform 1 from public.duels limit 1;
    reset role;
    raise exception 'Caso13: anon PUDO leer public.duels';
  exception
    when insufficient_privilege then
      reset role;
      raise notice 'DUELS RLS — anon denegado, como debe ser';
  end;
end;
$$;

rollback;
