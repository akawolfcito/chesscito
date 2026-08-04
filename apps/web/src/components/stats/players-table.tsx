"use client";

import { useState } from "react";

import { PlayerIdentityPill } from "@/components/identity/player-identity-pill";
import { formatNickname, type NicknameTokens } from "@/lib/identity/identity-lite";
import type { PlayersCensus } from "@/lib/stats/players-census";

/**
 * Rows per page.
 *
 * ⚠️ Equal in value to `BOARD_CUT` (the Leaders podium) and unrelated to it.
 * That one mirrors a `LIMIT 10` in SQL; this one is how tall this block is
 * allowed to get. Sharing them would bind the podium to this table's layout.
 */
export const PLAYERS_PAGE_SIZE = 10;

type PlayersTableProps = {
  census: PlayersCensus;
  nicknameTokens: NicknameTokens;
};

const numberFormat = new Intl.NumberFormat("en-US");

/** Same shape the page header uses for its own stamp, so two timestamps on one
 *  screen never look like two different kinds of fact. */
function formatAsOf(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "an unknown time";
  return parsed.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

/**
 * The census list: every ranked player, ten at a time.
 *
 * This is the one client component in an otherwise server-rendered dashboard,
 * and it exists only because Prev/Next needs state. `stats-page.tsx` stays a
 * Server Component — converting 1500 lines of dashboard to ship a paginator
 * would be a poor trade.
 *
 * ⛔ IT RENDERS, IT DOES NOT RE-DERIVE. No sorting, no deduplicating, no
 * identity derivation. Order comes from the view's `ORDER BY` (tiebreak
 * included), identity was derived server-side with the wallet discarded, and
 * `rank` is a column. Recomputing any of them here would create a second
 * source of truth that can disagree with the number printed beside it.
 */
export function PlayersTable({ census, nicknameTokens }: PlayersTableProps) {
  const [page, setPage] = useState(0);

  const rowsAvailable = census.rowsRead === "ok";

  // The population exceeded what the snapshot carries. Undeclared, the table
  // silently passes itself off as the census it is not. Only computable when
  // there is a population to compare against — guessing at truncation from the
  // row count alone would be inventing a caveat.
  const truncated =
    rowsAvailable && census.total !== null && census.total > census.rows.length;

  const pageCount = Math.ceil(census.rows.length / PLAYERS_PAGE_SIZE);
  // Never clamp by slicing short: a partial last page is correct (17 = 10 + 7)
  // and padding it to full height would render phantom players at 390px.
  const start = page * PLAYERS_PAGE_SIZE;
  const visible = census.rows.slice(start, start + PLAYERS_PAGE_SIZE);

  return (
    <section>
      <h3
        className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-wide"
        style={{ color: "var(--paper-text-subtle)" }}
      >
        Players Census
      </h3>

      {/* The block's LOCAL header. Everything here is an adjacency rule: the
          page already carries a global "as of" and a global truncation notice,
          both at the very top, and this table sits eight sections below them.
          A caveat the reader cannot see beside the number it qualifies is not
          a caveat. It also does not belong to the paginator below, which knows
          only about pages. */}
      <p
        className="mb-1 text-[0.6875rem] leading-tight"
        style={{ color: "var(--paper-text-subtle)" }}
      >
        Every ranked player — not affected by the filters above.
      </p>

      {census.total !== null ? (
        <p
          data-testid="census-total"
          className="text-xs font-semibold"
          style={{ color: "var(--paper-text)" }}
        >
          {numberFormat.format(census.total)} ranked players
        </p>
      ) : null}

      {/* This snapshot's own age. The census caches on its own entry, so the
          page's `generatedAt` describes different data. Absent entirely when
          the rows read failed: "as of 10:30" over a failed read claims a
          census happened at 10:30, and none did. */}
      {rowsAvailable ? (
        <p
          data-testid="census-as-of"
          className="mb-2 text-[0.625rem]"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          Census as of {formatAsOf(census.asOf)}
        </p>
      ) : (
        /* A DIFFERENT claim, deliberately worded as an ATTEMPT rather than a
           census: "Census as of 10:30" over a failed read would assert a census
           happened at 10:30, and none did. But hiding the stamp entirely was
           worse — a failed read caches like any other, and production served a
           dark census for 18h34m across a full deploy with nothing on screen
           saying how old the silence was. An age the reader can see is the only
           way that stops being invisible. */
        <p
          data-testid="census-last-attempt"
          className="mb-2 text-[0.625rem]"
          style={{ color: "var(--paper-text-subtle)" }}
        >
          Last attempted {formatAsOf(census.asOf)} — unavailable since.
        </p>
      )}

      {truncated ? (
        <p
          className="mb-2 text-[0.6875rem] leading-snug"
          style={{ color: "var(--paper-text-muted)" }}
        >
          Showing the first {numberFormat.format(census.rows.length)} of{" "}
          {numberFormat.format(census.total as number)} — this page carries a
          capped slice, not the whole ranking.
        </p>
      ) : null}

      {!rowsAvailable ? (
        <p className="text-xs" style={{ color: "var(--paper-text-subtle)" }}>
          The player list is temporarily unavailable.
        </p>
      ) : census.rows.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--paper-text-subtle)" }}>
          No ranked players yet. The first saved score opens the board.
        </p>
      ) : (
      <ol className="border-t" style={{ borderColor: "var(--paper-divider)" }}>
        {visible.map((row) => (
          // Keyed by rowId, never by nickname: with 6 pieces x 6 styles x
          // 10000 numbers, two players sharing a visible name is likely at the
          // row ceiling, and keying by name would collapse them into one.
          <li
            key={row.rowId}
            className="flex items-center justify-between gap-2 border-b py-2 text-xs"
            style={{
              color: "var(--paper-text)",
              borderColor: "var(--paper-divider)",
            }}
          >
            <span
              className="w-8 text-center font-bold"
              style={{ color: "var(--paper-text-muted)" }}
            >
              #{row.rank}
            </span>
            <PlayerIdentityPill
              variant={row.variant}
              name={formatNickname(row.variant, nicknameTokens)}
              size="sm"
              className="flex-1"
            />
            <span className="font-semibold">
              {numberFormat.format(row.totalScore)}
            </span>
          </li>
        ))}
      </ol>
      )}

      {/* One page means nothing to page through — the controls would be inert
          furniture on a 390px screen. */}
      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="min-h-[36px] rounded-xl border px-3 text-[0.6875rem] font-bold uppercase tracking-wide disabled:opacity-40"
            style={{
              borderColor: "var(--paper-divider)",
              color: "var(--paper-text-muted)",
            }}
          >
            Previous
          </button>
          <span
            className="text-[0.6875rem] font-semibold"
            style={{ color: "var(--paper-text-subtle)" }}
          >
            Page {page + 1} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
            className="min-h-[36px] rounded-xl border px-3 text-[0.6875rem] font-bold uppercase tracking-wide disabled:opacity-40"
            style={{
              borderColor: "var(--paper-divider)",
              color: "var(--paper-text-muted)",
            }}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
