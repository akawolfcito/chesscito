-- Chesscito — Web Early Access: la cola de solicitudes
--
-- ⛔ ESTA TABLA NO OTORGA ACCESO. LEER ESTO ANTES DE TOCARLA.
--
-- El acceso a Chesscito Web lo concede UN solo sistema: el allowlist propio de
-- Privy (Dashboard → Users → Access Control), aplicado por el servidor de login
-- de Privy. Un jugador que no está en esa lista no puede obtener sesión diga lo
-- que diga esta tabla, y uno que sí está entra aunque acá no exista una fila.
--
-- Por eso el estado terminal se llama `allowlisted` y NO `approved`. `approved`
-- se leería como una decisión que tomó este sistema, y convertiría en silencio a
-- esta tabla en una segunda fuente de verdad sobre un hecho que no le pertenece.
-- La fila es un REGISTRO DE UNA ACCIÓN HECHA EN PRIVY, y el nombre lo dice: para
-- que `allowlisted` sea cierto, alguien tuvo que agregar ese email al allowlist
-- de Privy primero. El orden operativo es fijo y en un solo sentido:
--
--   1. agregar el email al allowlist de Privy   ← esto es lo que otorga
--   2. marcar la fila como `allowlisted`        ← esto sólo registra
--
-- Invertirlos deja una fila que afirma acceso sobre alguien que no puede entrar.
-- Ningún código de la app lee este `status` para decidir nada — se puede grepear.
--
-- POR QUÉ EXISTE ENTONCES. Dos trabajos, ninguno de seguridad:
--   a) una cola ORDENADA por `requested_at` que el founder recorre a mano (~25);
--   b) el primer escalón del funnel de investigación (requested → …).
--
-- Diseño: docs/specs/2026-08-10-web-early-access-design.md §B5.

create table if not exists public.web_early_access (
  -- El email es la PK porque es exactamente la llave con la que el allowlist de
  -- Privy identifica a una persona: hablar el mismo idioma que el sistema que
  -- efectivamente otorga es lo que hace que las dos listas se puedan conciliar
  -- mirándolas. Normalizado (trim + lowercase) SIEMPRE del lado del servidor en
  -- `normalizeEarlyAccessEmail`, así ` Ana@Example.com ` y `ana@example.com` no
  -- ocupan dos lugares de una cola de 25.
  email          text primary key,

  status         text not null default 'waiting'
                 check (status in ('waiting', 'allowlisted')),

  surface        text check (surface in ('learn', 'play')),

  -- Dimensión de atribución ya normalizada por `normalizeSource` (la MISMA
  -- allowlist que usa la telemetría). Nullable a propósito: una solicitud sin
  -- atribución se registra como tal en vez de rellenarse con un default que
  -- parecería atribución real.
  source         text,

  -- Notas cualitativas del founder. Esta cohorte es de investigación; el lugar
  -- para "me escribió por WhatsApp", "no entendió qué era" o "volvió al día 3"
  -- es acá y no un spreadsheet aparte.
  note           text,

  requested_at   timestamptz not null default now(),

  -- Cuándo se hizo el paso 1 (el alta en Privy), no cuándo lo decidimos.
  allowlisted_at timestamptz,
  allowlisted_by text,

  updated_at     timestamptz not null default now()
);

-- La cola se recorre por antigüedad. Índice explícito porque ese es EL acceso
-- de lectura de esta tabla: `where status = 'waiting' order by requested_at`.
create index if not exists web_early_access_waiting_idx
  on public.web_early_access (requested_at)
  where status = 'waiting';

-- ─────────────────────────────────────────────────────────────────
-- RLS — deny total salvo service_role
-- ─────────────────────────────────────────────────────────────────
-- Sin policies ⇒ default-deny para anon y authenticated, que es la postura de
-- `analytics_events` y `passport_cache` (ver 20260806010000_baseline_rls_parity).
-- Escribe únicamente /api/early-access/request con service_role, que saltea RLS.
--
-- ⚠️ Esto importa MÁS que en las otras tablas: es la única de `public` que
-- guarda un dato personal directo y no seudonimizado. En todo el resto la
-- identidad viaja como `account_ref`, un HMAC irreversible. Acá hay emails.
-- Un `select` de anon sobre esta tabla sería una fuga de una lista de correos.
--
-- Y no alcanza con este comentario: la migración 20260806010000 existe
-- precisamente porque otra migración AFIRMABA tener RLS sin haberlo ejecutado
-- nunca. Verificar con `set role anon; select * from public.web_early_access;`
-- (debe dar permission denied), no leyendo este archivo.

alter table public.web_early_access enable row level security;

-- Defensa en profundidad sobre los default privileges de Supabase (ALL a
-- anon/authenticated sobre `public`): con RLS activo ya no pasan, pero revocar
-- deja el estado correcto aunque alguien agregue una policy permisiva sin
-- pensarlo. `service_role` no se toca — es quien escribe.
revoke all on public.web_early_access from anon, authenticated;

comment on table public.web_early_access is
  'Cola de solicitudes de Chesscito Web Early Access. NO otorga acceso: el '
  'allowlist de Privy es lo que concede. `allowlisted` REGISTRA que el email ya '
  'fue dado de alta en Privy; nunca lo causa. Ver el header de la migración '
  '20260810000000_web_early_access.sql.';

comment on column public.web_early_access.status is
  'waiting = pidió y no está en el allowlist de Privy. allowlisted = ya fue '
  'agregado al allowlist de Privy (registro posterior al hecho, jamás la causa).';
