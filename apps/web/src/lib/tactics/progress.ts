export const PLAY_TACTICS_STORAGE_KEY = "chesscito:play:tactics:v1";

export type PlayTacticsProgress = {
  lastCompletedDate: string | null;
  totalCompleted: number;
};

const DEFAULT_PROGRESS: PlayTacticsProgress = {
  lastCompletedDate: null,
  totalCompleted: 0,
};

export function playTacticsTodayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function parseProgress(value: unknown): PlayTacticsProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_PROGRESS };
  }
  const record = value as Record<string, unknown>;
  return {
    lastCompletedDate:
      typeof record.lastCompletedDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(record.lastCompletedDate)
        ? record.lastCompletedDate
        : null,
    totalCompleted:
      typeof record.totalCompleted === "number" &&
      Number.isFinite(record.totalCompleted) &&
      record.totalCompleted >= 0
        ? Math.floor(record.totalCompleted)
        : 0,
  };
}

export function getPlayTacticsProgress(): PlayTacticsProgress {
  if (typeof window === "undefined") return { ...DEFAULT_PROGRESS };
  try {
    const raw = window.localStorage.getItem(PLAY_TACTICS_STORAGE_KEY);
    return raw ? parseProgress(JSON.parse(raw)) : { ...DEFAULT_PROGRESS };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function isPlayTacticsCompletedToday(
  today: string = playTacticsTodayUtc(),
  progress: PlayTacticsProgress = getPlayTacticsProgress(),
): boolean {
  return progress.lastCompletedDate === today;
}

export function recordPlayTacticsCompletion(
  today: string = playTacticsTodayUtc(),
): PlayTacticsProgress {
  const previous = getPlayTacticsProgress();
  if (previous.lastCompletedDate === today) return previous;

  const next: PlayTacticsProgress = {
    lastCompletedDate: today,
    totalCompleted: previous.totalCompleted + 1,
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        PLAY_TACTICS_STORAGE_KEY,
        JSON.stringify(next),
      );
    } catch {
      // Storage can be unavailable in private/WebView contexts. The solve
      // remains successful in memory and can be retried after refresh.
    }
  }
  return next;
}
