import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dailyProgressStorageKey,
  labyrinthBestStorageKey,
  pieceProgressStorageKey,
  trainingContentSelectionStorageKey,
} from "@/lib/lite-progress-storage";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Lite progress storage namespace", () => {
  it("keeps the shipped v1 keys when no version is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_LITE_PROGRESS_VERSION", "");

    expect(pieceProgressStorageKey("rook")).toBe("chesscito:progress:rook");
    expect(dailyProgressStorageKey()).toBe("chesscito:daily-progress");
    expect(labyrinthBestStorageKey("rook")).toBe("chesscito:labyrinth-best:rook");
    expect(trainingContentSelectionStorageKey("rook")).toBe(
      "chesscito:training-content:rook",
    );
  });

  it("isolates all Lite progress key families when a QA version is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_LITE_PROGRESS_VERSION", "qa-2026-06-21");

    expect(pieceProgressStorageKey("rook")).toBe(
      "chesscito:lite:qa-2026-06-21:progress:rook",
    );
    expect(dailyProgressStorageKey()).toBe(
      "chesscito:lite:qa-2026-06-21:daily-progress",
    );
    expect(labyrinthBestStorageKey("rook")).toBe(
      "chesscito:lite:qa-2026-06-21:labyrinth-best:rook",
    );
    expect(trainingContentSelectionStorageKey("rook")).toBe(
      "chesscito:lite:qa-2026-06-21:training-content:rook",
    );
  });
});
