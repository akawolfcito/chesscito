-- Chesscito — La perilla del presupuesto de logins web
--
-- ⛔ ESTA TABLA NO OTORGA NI NIEGA ACCESO. LEER ESTO ANTES DE TOCARLA.
--
-- Quien CONCEDE el acceso web sigue siendo el allowlist propio de Privy
-- (Dashboard → Users → Access Control), server-side y sin bypass de cliente.
-- Esta fila es un PRESUPUESTO: le dice a nuestro propio cliente cuándo dejar de
-- llamar a `login()`. Su razón de ser es financiera, no de seguridad — el plan
-- Core de Privy es gratis hasta 499 MAU y salta a $299/mes desde 500.
--
-- Si alguien lee esto como control de acceso y apaga el allowlist de Privy
-- "porque ya tenemos el tope", el acceso queda abierto de par en par.
--
-- POR QUÉ ES UNA FILA Y NO UN ENV VAR. Porque en Vercel toda env var exige un
-- redeploy, y un redeploy de este repo tarda 8–10 minutos (medido por el founder
-- durante el pico de MiniPay de los primeros días). Durante un pico eso no es
-- una perilla: para cuando el deploy termina, la gente ya entró y el daño está
-- hecho. Con la fila, cambiar el número o apagar el acceso son segundos.
--
-- ⚠️ Lo que la fila NO arregla: el chequeo no puede ser transaccional con el
-- contador de Privy, así que N visitantes simultáneos cerca del umbral leen
-- todos "hay lugar" y entran todos. Para eso está el margen (460 sobre 499). La
-- fila mejora el TIEMPO DE REACCIÓN, no la atomicidad.
--
-- Spec: docs/specs/2026-08-13-login-capacity-cap-spec.md

create table if not exists public.login_capacity_config (
  -- Singleton por construcción: `boolean primary key check (id)` sólo admite la
  -- fila `true`. Una tabla de config con dos filas es una tabla de config sin
  -- respuesta, y el bug se descubre el día del pico.
  id          boolean primary key default true check (id),

  -- ⚠️ `limit` es palabra reservada en SQL; el nombre largo evita tener que
  -- citarla en cada query y que una comilla olvidada rompa el read del tope.
  --
  -- ⛔ El check es `> 0` y NO `< 499`. El techo del plan es un hecho de Privy
  -- que puede cambiar con su pricing, y hornearlo acá haría que el día que suban
  -- el plan la migración mienta. El margen se justifica en el código y en el
  -- default, no en un constraint.
  seat_limit  integer not null check (seat_limit > 0),

  -- El interruptor para reabrir sin tocar el número.
  enabled     boolean not null default true,

  updated_at  timestamptz not null default now(),

  -- Quién movió la perilla. Texto libre a propósito: esto lo edita una persona
  -- desde el dashboard de Supabase, no un sistema con identidades.
  updated_by  text
);

-- El default arranca en 460, que deja 39 lugares de margen bajo los 499 del plan
-- gratis. `on conflict do nothing` para que re-aplicar la migración no pise una
-- perilla que el founder ya movió a mano.
insert into public.login_capacity_config (id, seat_limit, enabled, updated_by)
values (true, 460, true, 'migration:20260814000000')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────
-- RLS — deny total salvo service_role
-- ─────────────────────────────────────────────────────────────────
-- Sin policies ⇒ default-deny para anon y authenticated. Lee únicamente
-- /api/access/capacity con service_role, que saltea RLS.
--
-- ⚠️ El tope no es un secreto de seguridad, pero SÍ es un número que no debe
-- viajar al cliente: decirle a un visitante "quedan 3 lugares" es una carrera y
-- una invitación a forzarla. La ruta responde `{ open }` y nada más; que anon no
-- pueda leer la tabla cierra la otra puerta a ese mismo número.
--
-- Y no alcanza con este comentario: la migración 20260806010000 existe porque
-- otra AFIRMABA tener RLS sin haberlo ejecutado nunca. Verificar con
-- `set role anon; select * from public.login_capacity_config;` (debe dar
-- permission denied), no leyendo este archivo.

alter table public.login_capacity_config enable row level security;

revoke all on public.login_capacity_config from anon, authenticated;

comment on table public.login_capacity_config is
  'Perilla EN VIVO del presupuesto de logins web (Privy). NO otorga ni niega '
  'acceso: el allowlist de Privy es lo que concede. Existe como fila y no como '
  'env var porque un redeploy tarda 8-10 min y durante un pico eso llega tarde. '
  'Ver el header de la migración 20260814000000_login_capacity_config.sql.';

comment on column public.login_capacity_config.seat_limit is
  'Tope de cuentas de container=browser. Debe quedar POR DEBAJO del límite del '
  'plan de Privy (499 hoy): el chequeo no es transaccional, así que hace falta '
  'margen para el pelotón que toca ENTER a la vez.';

comment on column public.login_capacity_config.enabled is
  'false = sin tope, se admite todo login. El interruptor para reabrir en un tap '
  'sin tener que elegir un número.';
