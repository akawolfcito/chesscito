-- Chesscito — El duelo p2p por enlace
--
-- Spec:  docs/specs/2026-08-13-p2p-chess-duel-by-link-spec.md
-- Plan:  docs/plans/2026-08-14-p2p-duel-tdd-plan.md (Etapa 2)
-- Red-team: docs/specs/2026-08-13-p2p-chess-duel-by-link-redteam.md
--
-- ⛔ AQUÍ NO HAY RLS POR USUARIO, Y ES UNA DECISIÓN, NO UN OLVIDO.
--
-- La autorización de este feature NO pasa por la identidad del que pide: pasa
-- por una credencial opaca de 128 bits que emite el servidor y de la que esta
-- tabla sólo guarda el SHA-256. Un `walletAddress` en un body es un dato que el
-- cliente elige — es exactamente el defecto que mató a la v2 de este feature y
-- que sigue vivo en `api/games/route.ts:21`, donde `isAddress()` valida el
-- FORMATO y no la propiedad.
--
-- Por eso: RLS prendida SIN policies (deny total para anon y authenticated) y
-- todo el acceso por `service_role` desde las rutas, que resuelven el asiento
-- con `lib/duel/seat-token.ts`. Una policy por wallet acá sería teatro: le daría
-- autoridad al mismo dato que el spec le prohíbe tenerla.
--
-- ⚠️ VERIFICAR, NO LEER: `set role anon; select * from public.duels;` debe dar
-- permission denied. Existe la migración 20260806010000 porque otra AFIRMABA
-- tener RLS sin haberla ejecutado nunca. Hay un smoke que lo prueba contra un
-- Postgres vivo: `supabase/tests/duels_smoke.sql`.
--
-- ⛔ POR QUÉ NO ROTA EL TOKEN. El red-team marcó que un asiento robado "juega
-- para siempre". En este diseño no: la credencial no autoriza por sí sola, sino
-- DENTRO de un duelo, y el duelo se muere solo — 1 h de invitación más una
-- partida con techo de 30 min por lado. Rotar sería peor que el problema: en
-- móvil el token viaja en el body y lo guarda el cliente, así que una rotación
-- perdida (pestaña cerrada, navegador in-app, red) deja al jugador afuera de su
-- propia partida CON SU RELOJ CORRIENDO. Cambia un robo hipotético por una
-- derrota real. Lo que sí existe es vencimiento y purga: ver `purge_duels`.

create table if not exists public.duels (
  -- ⛔ 128 bits base64url. El check no es cosmético: es lo que impide que
  -- alguien "simplifique" esto a un serial y convierta el enlace en algo que se
  -- adivina contando. No enumerable, no autoincremental, no UUIDv1.
  id text primary key check (id ~ '^[A-Za-z0-9_-]{22}$'),

  status text not null check (
    status in ('awaiting-opponent', 'active', 'finished', 'expired')
  ),

  -- ── Los dos asientos, en columnas planas ──────────────────────────
  -- El ajedrez tiene exactamente dos colores y no va a tener un tercero, así
  -- que una tabla hija sólo agregaría un join en la ruta caliente y un CAS
  -- repartido en dos tablas. Planas, el `update ... where version = $n` es uno.
  --
  -- ⛔ `token_hash` NULL = asiento LIBRE. Nunca el hash de una cadena vacía:
  -- `resolveSeat` se saltea el asiento sin hash a propósito, o el próximo que
  -- entregue el hash de la nada se sienta en el lugar del invitado.
  white_token_hash   text check (white_token_hash ~ '^[0-9a-f]{64}$'),
  black_token_hash   text check (black_token_hash ~ '^[0-9a-f]{64}$'),

  -- Cosmético y de un desconocido: tope de longitud EN LA BASE. El escapado es
  -- del render, pero el largo se corta acá o el día que una ruta se olvide, el
  -- rival ve un nombre de 4 KB haciéndose pasar por la interfaz
  -- (*"Sistema: has perdido"*). Es el P2 de contratos del red-team.
  white_display_name text check (char_length(white_display_name) <= 24),
  black_display_name text check (char_length(black_display_name) <= 24),

  white_claimed_at   timestamptz,
  black_claimed_at   timestamptz,

  -- ⛔ EL TIEMPO VIVE POR ASIENTO. Hoy los dos arrancan iguales y un solo campo
  -- alcanzaría — y sería la decisión que habría que deshacer con una migración
  -- el día del handicap de tiempo que el founder ya nombró como próximo paso.
  -- Por asiento, el handicap es arrancarlos distinto y NADA más.
  white_remaining_ms integer not null check (white_remaining_ms >= 0),
  black_remaining_ms integer not null check (black_remaining_ms >= 0),

  -- ── La partida ────────────────────────────────────────────────────
  moves text[] not null default '{}',

  -- ⚠️ El FEN JUNTO a las movidas no es redundancia: es lo que evita
  -- reconstruir 60 movidas en cada request. Era un P0 del red-team ("el árbitro
  -- reconstruye la partida entera EN CADA JUGADA") y se cierra acá, en el
  -- esquema. `moves` queda para la repetición triple y para mostrar la partida.
  fen text not null,

  outcome jsonb check (
    outcome is null or outcome->>'kind' in ('checkmate', 'resign', 'timeout', 'draw')
  ),

  -- CAS. Todo write manda el `version` que leyó y el servidor rechaza si no
  -- coincide; el perdedor recibe `version-conflict` con estado fresco.
  version integer not null default 1 check (version >= 1),

  created_at   timestamptz not null default now(),

  -- ⚠️ SÓLO el reloj de la INVITACIÓN (1 h). Una vez `active`, quien termina la
  -- partida es el reloj de ajedrez, no esto.
  expires_at   timestamptz not null,

  -- Sello del SERVIDOR en la última jugada. Contra esto se descuenta, y con
  -- esto el cliente interpola sus relojes sin polear más seguido.
  last_move_at timestamptz,

  -- Informativo: la verdad del tiempo vive en las dos columnas `remaining_ms`.
  -- ⛔ El check ES el criterio de aceptación *"la escalera sólo admite sus siete
  -- valores"*. Encodearlo acá lo hace cierto aunque una ruta futura se olvide;
  -- dejarlo sólo en TypeScript lo hace cierto hasta el primer `curl`.
  initial_minutes numeric(3,1) not null check (
    initial_minutes in (0.5, 1, 3, 5, 10, 15, 30)
  ),

  -- ⛔ Quién invitó. Lo escribe el SERVIDOR desde la sesión del creador, NUNCA
  -- desde el body. El founder quiere premiar a quien trae gente, y un dato que
  -- el cliente elige se falsifica el día que vale algo. Es atribución, jamás
  -- autorización: nada de acá concede un asiento.
  invited_by text,

  -- ── Invariantes de estado, como constraints ───────────────────────
  -- Cada uno de estos es un comportamiento del spec. Están acá y no sólo en la
  -- ruta porque un comentario no es un control.

  -- Un duelo terminado tiene resultado, y uno no terminado no lo tiene.
  constraint duels_outcome_matches_status check (
    (status = 'finished') = (outcome is not null)
  ),

  -- `active` exige los dos asientos ocupados y un sello contra el cual
  -- descontar. Sin `last_move_at` el reloj no tiene contra qué correr.
  constraint duels_active_is_seated check (
    status <> 'active'
    or (white_token_hash is not null
        and black_token_hash is not null
        and last_move_at is not null)
  ),

  -- ⛔ `expired` es SÓLO el enlace que nadie contestó (comportamiento 14: nunca
  -- contestar no es una derrota). Una partida empezada termina por bandera,
  -- `finished` + `timeout` (comportamiento 15). Sin este check, una ruta podría
  -- escribir `expired` encima de una partida viva y BORRAR una victoria por
  -- tiempo sin que nada se queje.
  constraint duels_expired_never_had_two_players check (
    status <> 'expired'
    or white_token_hash is null
    or black_token_hash is null
  ),

  -- El creador se sienta al crear: un duelo sin nadie no existe.
  constraint duels_creator_is_seated check (
    white_token_hash is not null or black_token_hash is not null
  ),

  -- Un asiento reclamado tiene credencial y sello, y uno libre no tiene ninguno.
  constraint duels_white_seat_is_coherent check (
    (white_token_hash is null) = (white_claimed_at is null)
  ),
  constraint duels_black_seat_is_coherent check (
    (black_token_hash is null) = (black_claimed_at is null)
  )
);

-- La purga barre por antigüedad, así que el índice es por `created_at`.
-- No hay índice por jugador: en v1 no hay historial, ni lobby, ni revancha.
create index if not exists duels_created_at_idx on public.duels (created_at);

-- ─────────────────────────────────────────────────────────────────
-- Retención — la revocación real de una credencial es borrar la fila
-- ─────────────────────────────────────────────────────────────────
-- El red-team pedía, en preparación operativa, decir si un duelo colgado se
-- puede purgar y cómo. Esto es el cómo.
--
-- ⚠️ NADA LO LLAMA TODAVÍA: no hay cron ni job, igual que la expiración, que se
-- materializa al leer. Es una herramienta de ops a un `select` de distancia, y
-- quién la dispara es una decisión abierta — no la finge esta migración.
--
-- El default de 7 días es 80× el techo de vida de un duelo (1 h de invitación +
-- 1 h de partida en el peor caso de la escalera), así que no puede alcanzar a
-- una partida viva ni aunque nadie la haya leído para materializarle la bandera.
create or replace function public.purge_duels(older_than interval default '7 days')
returns integer
language plpgsql
as $$
declare
  removed integer;
begin
  delete from public.duels where created_at < now() - older_than;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- ─────────────────────────────────────────────────────────────────
-- RLS — deny total salvo service_role
-- ─────────────────────────────────────────────────────────────────
-- Sin policies ⇒ default-deny para anon y authenticated. Leen y escriben
-- únicamente las rutas `/api/duel/*` con service_role, que saltea RLS.
--
-- ⛔ `revoke from public` no alcanza en Supabase: anon y authenticated tienen
-- grants propios y hay que nombrarlos.

alter table public.duels enable row level security;

revoke all on public.duels from anon, authenticated;
revoke all on function public.purge_duels(interval) from public, anon, authenticated;

comment on table public.duels is
  'Duelo de ajedrez p2p por enlace. La autoridad sobre un asiento sale de una '
  'credencial del servidor (SHA-256 en white/black_token_hash), NUNCA de una '
  'wallet ni de ningún id que mande el cliente. RLS deny-total a propósito: '
  'toda la autorización pasa por el token. Ver el header de la migración '
  '20260814120000_p2p_duels.sql.';

comment on column public.duels.fen is
  'Posición actual, guardada JUNTO a `moves` para que aplicar una jugada no '
  'reconstruya la partida desde la movida 1. `moves` se usa para la repetición '
  'triple y para mostrar la partida.';

comment on column public.duels.white_remaining_ms is
  'Banco de tiempo del asiento blanco. POR ASIENTO y no un campo del duelo: el '
  'handicap de tiempo futuro es arrancar los dos con valores distintos.';

comment on column public.duels.invited_by is
  'Atribución escrita por el SERVIDOR desde la sesión del creador. Nunca sale '
  'del body y nunca concede autoridad sobre un asiento.';

comment on function public.purge_duels(interval) is
  'Borra duelos más viejos que `older_than` (default 7 días). Nada lo llama '
  'automáticamente: es una herramienta de ops. Borrar la fila ES la revocación '
  'de las credenciales de ese duelo.';
