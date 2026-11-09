import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec: docs/specs/2026-08-13-p2p-chess-duel-by-link-spec.md (Etapa 2 del plan).
 *
 * ⚠️ Este guard sólo puede afirmar lo que el TEXTO de la migración dice. Que la
 * base lo HAGA lo prueba `supabase/tests/duels_smoke.sql` contra un Postgres
 * vivo (verificado por mutación el 2026-08-14). Este archivo existe para que un
 * PR que borre un invariante no pase en verde: la suite no levanta base.
 */
const migration = fs.readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/20260814120000_p2p_duels.sql"),
  "utf8",
);

/**
 * Toda afirmación sobre COLUMNAS se hace contra el `create table` pelado.
 *
 * ⚠️ No alcanza con sacar los `--`: los `comment on ... is '…'` son strings SQL
 * y nombran a propósito lo que la tabla NO hace ("nunca de una wallet"). Una
 * aserción sobre el archivo entero se rompe con el comentario que la explica.
 */
const ddl = (() => {
  const start = migration.indexOf("create table");
  const end = migration.indexOf("\n);", start);
  if (start < 0 || end < 0) throw new Error("no se encontró el create table");
  return migration.slice(start, end).replace(/--.*$/gm, "");
})();

describe("esquema de duels", () => {
  it("el id no es enumerable: 128 bits base64url impuestos por check", () => {
    expect(ddl).toMatch(/id text primary key check \(id ~ '\^\[A-Za-z0-9_-\]\{22\}\$'\)/);
    expect(ddl).not.toMatch(/\b(serial|bigserial|generated always as identity)\b/i);
  });

  it("guarda el HASH del token y nunca el token", () => {
    expect(ddl).toMatch(/white_token_hash\s+text check \(white_token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
    expect(ddl).toMatch(/black_token_hash\s+text check/);
    // Un token en claro en una columna sería el feature entero al revés.
    expect(ddl).not.toMatch(/\btoken\s+text\b/);
  });

  it("ninguna wallet participa del camino de autorización", () => {
    expect(ddl).not.toMatch(/\bwallet\b/i);
    expect(ddl).not.toMatch(/\bplayer_id\b/i);
  });

  it("el tiempo vive POR ASIENTO — es el handicap futuro", () => {
    expect(ddl).toMatch(/white_remaining_ms integer not null check \(white_remaining_ms >= 0\)/);
    expect(ddl).toMatch(/black_remaining_ms integer not null check \(black_remaining_ms >= 0\)/);
    // Un único campo del duelo sería la decisión a deshacer con una migración.
    expect(ddl).not.toMatch(/\bremaining_ms\s+integer/);
  });

  it("la escalera admite sus siete valores y ninguno más", () => {
    expect(ddl).toMatch(
      /check \(\s*initial_minutes in \(0\.5, 1, 3, 5, 10, 15, 30\)\s*\)/,
    );
  });

  it("guarda el fen JUNTO a las movidas, que es lo que evita el replay", () => {
    expect(ddl).toMatch(/moves text\[\] not null/);
    expect(ddl).toMatch(/fen text not null/);
  });

  it("tiene los cuatro estados del spec y ningún `abandoned`", () => {
    expect(ddl).toMatch(
      /status in \('awaiting-opponent', 'active', 'finished', 'expired'\)/,
    );
    expect(ddl).not.toMatch(/abandoned/);
    expect(ddl).toMatch(/'checkmate', 'resign', 'timeout', 'draw'/);
  });

  it("lleva el CAS por version", () => {
    expect(ddl).toMatch(/version integer not null default 1 check \(version >= 1\)/);
  });

  it("encodea los invariantes de estado como constraints, no como comentarios", () => {
    for (const name of [
      "duels_outcome_matches_status",
      "duels_active_is_seated",
      "duels_expired_never_had_two_players",
      "duels_creator_is_seated",
      "duels_white_seat_is_coherent",
      "duels_black_seat_is_coherent",
    ]) {
      expect(ddl).toContain(`constraint ${name}`);
    }
  });

  it("le pone tope de longitud al nombre que escribe un desconocido", () => {
    expect(ddl).toMatch(/white_display_name text check \(char_length\(white_display_name\) <= 24\)/);
    expect(ddl).toMatch(/black_display_name text check/);
  });

  it("prende RLS y le revoca a anon y authenticated por nombre", () => {
    // `revoke from public` no alcanza en Supabase: anon y authenticated tienen
    // grants propios.
    expect(migration).toMatch(/alter table public\.duels enable row level security/);
    expect(migration).toMatch(/revoke all on public\.duels from anon, authenticated/);
    expect(migration).toMatch(
      /revoke all on function public\.purge_duels\(interval\) from public, anon, authenticated/,
    );
    // Sin policies: cualquier policy acá le daría autoridad a la identidad del
    // que pide, que es justo lo que el spec le prohíbe.
    expect(migration).not.toMatch(/create policy/i);
  });

  it("deja una purga, que es la única revocación real de una credencial", () => {
    expect(migration).toMatch(/create or replace function public\.purge_duels/);
    expect(migration).toMatch(/older_than interval default '7 days'/);
  });
});
