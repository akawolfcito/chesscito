/**
 * The only place that talks to the `duels` table.
 *
 * Everything above it is pure; everything below it is PostgREST. Keeping the
 * boundary this thin is what lets the interesting decisions be tested without a
 * database, and lets the one decision that CANNOT be tested without a database
 * — the compare-and-swap — be tested by asserting the query that gets built.
 *
 * ⛔ Authorization does not live here and must never move here. The table has
 * RLS on with zero policies (deny-total, verified by running it), every read
 * and write goes through `service_role`, and the seat is resolved from a
 * credential by `resolveSeat`. A filter by wallet in this file would be
 * theatre: it would give authority to exactly the datum the spec forbids it to.
 */

import { toDuel, toRow, type DuelRow } from "./row";
import type { Duel } from "./types";

const TABLE = "duels";

/** Postgres unique violation — the id was already taken. */
const UNIQUE_VIOLATION = "23505";

/**
 * The slice of the Supabase client this module uses. Narrow on purpose: it is
 * the whole surface a test has to stand in for, and it keeps a future caller
 * from reaching for `rpc` or `auth` through here.
 */
export type DuelQueryClient = {
  from(table: string): {
    select(columns?: string): DuelQueryBuilder;
    insert(payload: DuelRow): DuelQueryBuilder;
    update(payload: DuelRow): DuelQueryBuilder;
  };
};

type QueryResponse = { data: unknown; error: unknown };

type DuelQueryBuilder = {
  eq(column: string, value: unknown): DuelQueryBuilder;
  select(columns?: string): DuelQueryBuilder;
  maybeSingle(): PromiseLike<QueryResponse>;
} & PromiseLike<QueryResponse>;

export type FindResult =
  | { status: "found"; duel: Duel }
  | { status: "not-found" }
  | { status: "error" };

export type CreateResult = "created" | "conflict" | "error";

export type CommitResult = "committed" | "stale" | "error";

export type DuelRepository = {
  find(id: string): Promise<FindResult>;
  create(duel: Duel): Promise<CreateResult>;
  /**
   * The compare-and-swap. Writes `duel` only if the stored row is still at
   * `expectedVersion`.
   *
   * ⚠️ The caller decides what a `"stale"` means: for a move it is behaviour 16
   * (`version-conflict`, answered with fresh state); for the flag materialized
   * inside a GET it is nothing at all — somebody else already wrote it, and the
   * GET still answers the state it computed. Expiration is a function of time,
   * not a write permission.
   */
  commit(duel: Duel, expectedVersion: number): Promise<CommitResult>;
};

export function duelRepository(client: DuelQueryClient): DuelRepository {
  return {
    async find(id) {
      const { data, error } = await client
        .from(TABLE)
        .select("*")
        .eq("id", id)
        .maybeSingle();

      // ⛔ A database that is down is not "no such duel". Collapsing the two
      // answers 404 for a link that exists, and the guest is told the
      // invitation is wrong when the invitation is fine.
      if (error) return { status: "error" };
      if (!data) return { status: "not-found" };
      return { status: "found", duel: toDuel(data as DuelRow) };
    },

    async create(duel) {
      const { error } = await client.from(TABLE).insert(toRow(duel));
      if (!error) return "created";
      return codeOf(error) === UNIQUE_VIOLATION ? "conflict" : "error";
    },

    async commit(duel, expectedVersion) {
      const { data, error } = await client
        .from(TABLE)
        .update(toRow(duel))
        .eq("id", duel.id)
        // ⛔ THE WHOLE CONCURRENCY STORY OF THE SPEC IS THIS LINE. Without it
        // every move still "works" and the loser of a race silently overwrites
        // the winner — nothing observable changes, which is why the test
        // asserts on the query and not on a result.
        .eq("version", expectedVersion)
        .select("version");

      // ⛔ A failed write is not a lost race. Answering `stale` here tells the
      // player "somebody moved first" and sends the client into a
      // refetch-and-retry loop against a duel that never changed.
      if (error) return "error";
      return Array.isArray(data) && data.length > 0 ? "committed" : "stale";
    },
  };
}

function codeOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}
