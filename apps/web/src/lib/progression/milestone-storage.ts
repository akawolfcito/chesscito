import type { PieceId } from "@/lib/game/types";
import { todayUtc } from "@/lib/daily/progress";
import { milestoneStorageKey } from "@/lib/lite-progress-storage";
import type { EarnedMilestone } from "./milestones";
import {
  EMPTY_STORE,
  milestoneKey,
  NAVIGABLE_MILESTONES,
  type MilestoneEvent,
  type MilestoneId,
  type MilestoneStore,
} from "./types";

/** Resets with the UTC day. Everything else is cumulative and permanent. */
const DAILY_MILESTONES: readonly MilestoneId[] = ["great-focus-session"];

/** Narrows an unknown `events` entry to a well-formed `MilestoneEvent`. A
 *  partially-written or corrupted entry (e.g. `null`) is silently dropped
 *  rather than crashing the reader that dereferences it downstream. */
function isValidMilestoneEvent(value: unknown): value is MilestoneEvent {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<MilestoneEvent>;
  return typeof candidate.id === "string" && typeof candidate.earnedAt === "string";
}

export function parseMilestoneStore(
  raw: string | null,
  today: string = todayUtc(),
): MilestoneStore {
  // A fresh store must still stamp `dailyDate` to `today` — leaving it
  // `null` makes the very next daily-reset comparison see `null !== today`
  // and wipe an event that was just recorded, before it was ever
  // celebrated (the "double celebration" bug).
  const empty = { ...EMPTY_STORE, dailyDate: today };
  if (!raw) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return empty;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as Partial<MilestoneStore>).version !== 1 ||
    typeof (parsed as Partial<MilestoneStore>).events !== "object" ||
    !(parsed as Partial<MilestoneStore>).events
  ) {
    return empty;
  }

  const rawEvents = (parsed as MilestoneStore).events;
  const events: Record<string, MilestoneEvent> = {};
  for (const [key, event] of Object.entries(rawEvents)) {
    if (isValidMilestoneEvent(event)) {
      events[key] = event;
    }
  }

  const storedDailyDate = (parsed as Partial<MilestoneStore>).dailyDate ?? null;
  if (storedDailyDate !== today) {
    for (const id of DAILY_MILESTONES) {
      for (const key of Object.keys(events)) {
        if (key === id || key.startsWith(`${id}:`)) {
          delete events[key];
        }
      }
    }
  }
  return { version: 1, events, dailyDate: today };
}

/** Records every earned milestone that is not already on disk. Returns the
 *  SAME reference when nothing is new, so callers can skip the write. */
export function computeRecordEarned(
  store: MilestoneStore,
  earned: readonly EarnedMilestone[],
  now: string,
): MilestoneStore {
  const fresh = earned.filter(
    (event) => !store.events[milestoneKey(event.id, event.piece)],
  );
  if (fresh.length === 0) return store;

  const events = { ...store.events };
  for (const event of fresh) {
    const record: MilestoneEvent = { id: event.id, earnedAt: now };
    if (event.piece) record.piece = event.piece;
    events[milestoneKey(event.id, event.piece)] = record;
  }
  return { ...store, events };
}

export function computeMarkCelebrated(
  store: MilestoneStore,
  id: MilestoneId,
  piece: PieceId | undefined,
  now: string,
): MilestoneStore {
  const key = milestoneKey(id, piece);
  const event = store.events[key];
  if (!event || event.celebratedAt) return store;
  return {
    ...store,
    events: { ...store.events, [key]: { ...event, celebratedAt: now } },
  };
}

/** Only a navigable milestone has somewhere to go. Writing `openedAt` on a
 *  recognition would invent a state with no meaning, so it is refused. */
export function computeMarkOpened(
  store: MilestoneStore,
  id: MilestoneId,
  piece: PieceId | undefined,
  now: string,
): MilestoneStore {
  if (!NAVIGABLE_MILESTONES.includes(id)) return store;
  const key = milestoneKey(id, piece);
  const event = store.events[key];
  if (!event || event.openedAt) return store;
  return {
    ...store,
    events: { ...store.events, [key]: { ...event, openedAt: now } },
  };
}

/** Earned but never celebrated. This is what the queue drains. */
export function selectPending(store: MilestoneStore): EarnedMilestone[] {
  return Object.values(store.events)
    .filter((event) => !event.celebratedAt)
    .map((event) => ({ id: event.id, piece: event.piece }));
}

// ─── localStorage I/O ────────────────────────────────────────────────────

export function getMilestoneStore(): MilestoneStore {
  if (typeof window === "undefined") return parseMilestoneStore(null);
  try {
    return parseMilestoneStore(localStorage.getItem(milestoneStorageKey()));
  } catch {
    return parseMilestoneStore(null);
  }
}

function persist(store: MilestoneStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(milestoneStorageKey(), JSON.stringify(store));
  } catch {
    // Quota or privacy mode — the caller still gets the correct state back.
  }
}

/** Persists BEFORE anything is rendered. If the app dies mid-overlay the
 *  event is already on disk, so it neither replays nor gets lost. */
export function recordEarned(
  earned: readonly EarnedMilestone[],
  now: string = new Date().toISOString(),
): MilestoneStore {
  const current = getMilestoneStore();
  const next = computeRecordEarned(current, earned, now);
  if (next !== current) persist(next);
  return next;
}

export function markCelebrated(
  id: MilestoneId,
  piece?: PieceId,
  now: string = new Date().toISOString(),
): MilestoneStore {
  const current = getMilestoneStore();
  const next = computeMarkCelebrated(current, id, piece, now);
  if (next !== current) persist(next);
  return next;
}

export function markOpened(
  id: MilestoneId,
  piece?: PieceId,
  now: string = new Date().toISOString(),
): MilestoneStore {
  const current = getMilestoneStore();
  const next = computeMarkOpened(current, id, piece, now);
  if (next !== current) persist(next);
  return next;
}
