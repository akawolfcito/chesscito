import { describe, expect, it } from "vitest";
import { nicknameTokensFromTranslator } from "../nickname-tokens";
import { formatNickname } from "../identity-lite";

// Fake translator mirroring the IDENTITY_COPY namespace (EN order).
function makeTranslator(map: Record<string, string>, rawMap: Record<string, string>) {
  const t = ((key: string) => map[key] ?? key) as {
    (key: string): string;
    raw: (key: string) => unknown;
  };
  t.raw = (key: string) => rawMap[key] ?? map[key] ?? key;
  return t;
}

describe("nicknameTokensFromTranslator", () => {
  it("assembles tokens and keeps the template raw (no ICU resolution)", () => {
    const t = makeTranslator(
      {
        "pieces.knight": "Knight",
        "styles.golden": "Golden",
        guestPrefix: "Guest",
      },
      { template: "{style} {piece} #{number}" },
    );
    const tokens = nicknameTokensFromTranslator(t);
    expect(tokens.pieces.knight).toBe("Knight");
    expect(tokens.styles.golden).toBe("Golden");
    expect(tokens.guestPrefix).toBe("Guest");
    expect(tokens.template).toBe("{style} {piece} #{number}");
    expect(
      formatNickname({ piece: "knight", style: "golden", number: 7 }, tokens),
    ).toBe("Golden Knight #7");
  });
});
