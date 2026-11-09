import type { GameResult, HistoryDigest, PlayerSummary } from "./types";

export type CoachLocale = "en" | "es";

/**
 * Truncate `text` to at most `max` Unicode code points. If exceeded, the
 * last char is replaced with U+2026 (HORIZONTAL ELLIPSIS) so the result
 * length is exactly `max`.
 *
 * Defense-in-depth for the augmentation block (red-team P1-3). v1
 * taxonomy makes >600 unreachable; v2 work must re-evaluate.
 */
export function truncateAtLimit(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

const RESULT_HINTS_EN: Record<GameResult, string> = {
  win: "The player won. Focus on: (1) strengths shown, (2) moments where a stronger opponent would have punished them, (3) how to win more efficiently.",
  lose: "The player lost. Be encouraging. Focus on: (1) what went wrong (kindly), (2) critical mistakes that turned the game, (3) concrete skills to practice.",
  draw: "The game was a draw. Focus on: (1) why the game didn't resolve, (2) missed opportunities to press advantage, (3) how to convert drawn positions.",
  resigned: "The player resigned. Focus on: (1) the turning point, (2) the position that felt lost + a safer continuation, (3) pattern recognition for similar positions.",
};

const RESULT_HINTS_ES: Record<GameResult, string> = {
  win: "El jugador ganó. Enfócate en: (1) fortalezas mostradas, (2) momentos donde un oponente más fuerte lo hubiera castigado, (3) cómo ganar de forma más eficiente.",
  lose: "El jugador perdió. Sé alentador. Enfócate en: (1) qué salió mal (con tono amable), (2) errores críticos que cambiaron la partida, (3) habilidades concretas para practicar.",
  draw: "La partida terminó en tablas. Enfócate en: (1) por qué la partida no se resolvió, (2) oportunidades perdidas de presionar la ventaja, (3) cómo convertir posiciones empatadas.",
  resigned: "El jugador se rindió. Enfócate en: (1) el momento clave, (2) la posición que se sintió perdida + una continuación más segura, (3) reconocimiento de patrones para posiciones similares.",
};

const HISTORY_BLOCK_CHAR_CAP = 600;

type HistoryCopy = {
  header: (gamesPlayed: number, win: number, lose: number, draw: number) => string;
  guardNoEvidence: string;
  tagsLine: (tags: string) => string;
  callout: string;
};

const HISTORY_COPY_EN: HistoryCopy = {
  header: (g, w, l, d) =>
    `Player history (last 20 games): ${g} games.\nRecent results: W:${w} L:${l} D:${d}.`,
  guardNoEvidence:
    "Insufficient pattern data this session. Do NOT speculate about\nrecurring weaknesses or strengths across past games. Analyze\nONLY the current game.",
  tagsLine: (tags) => `Recurring weakness areas: ${tags}.`,
  callout:
    "When analyzing this game, if any of the above weakness areas appear,\n" +
    'call them out by name. For example, "you\'ve shown weak king safety in 4 of\n' +
    'your last 8 games." Tie the call-out to the count above. ' +
    "Do not fabricate a pattern that isn't in the data.",
};

const HISTORY_COPY_ES: HistoryCopy = {
  header: (g, w, l, d) =>
    `Historial del jugador (últimas 20 partidas): ${g} partidas.\nResultados recientes: V:${w} D:${l} E:${d}.`,
  guardNoEvidence:
    "Datos de patrones insuficientes esta sesión. NO especules sobre\ndebilidades o fortalezas recurrentes entre partidas pasadas. Analiza\nÚNICAMENTE la partida actual.",
  tagsLine: (tags) => `Áreas de debilidad recurrentes: ${tags}.`,
  callout:
    "Al analizar esta partida, si aparece alguna de las áreas de debilidad\n" +
    'anteriores, menciónala por nombre. Por ejemplo, "has mostrado debilidad en\n' +
    'seguridad del rey en 4 de tus últimas 8 partidas." Liga la mención al\n' +
    "conteo anterior. No inventes un patrón que no esté en los datos.",
};

function buildHistoryAugmentation(
  history: HistoryDigest | null | undefined,
  locale: CoachLocale,
): string {
  if (!history) return "";

  const copy = locale === "es" ? HISTORY_COPY_ES : HISTORY_COPY_EN;
  const { gamesPlayed, recentResults, topWeaknessTags } = history;
  const header = copy.header(
    gamesPlayed,
    recentResults.win,
    recentResults.lose,
    recentResults.draw,
  );

  if (topWeaknessTags.length === 0) {
    return truncateAtLimit(`\n${header}\n\n${copy.guardNoEvidence}`, HISTORY_BLOCK_CHAR_CAP);
  }

  const tagsLine = copy.tagsLine(
    topWeaknessTags.map((t) => `${t.tag} (×${t.count})`).join(", "),
  );

  return truncateAtLimit(`\n${header}\n${tagsLine}\n\n${copy.callout}`, HISTORY_BLOCK_CHAR_CAP);
}

type IntroCopy = {
  intro: string;
  gameLabel: string;
  resultLabel: string;
  resultSuffix: (difficulty: string) => string;
  summary: (gamesPlayed: number, avg: number, weaknesses: string) => string;
  noWeakness: string;
  schemaPreamble: string;
  schemaSummary: string;
  schemaWhy: string;
  schemaLessons: string;
  schemaPraise: string;
  rulesHeader: string;
  rules: string[];
};

const INTRO_EN: IntroCopy = {
  intro:
    "You are a chess coach analyzing a game played on Chesscito (a learning app for beginners and casual players).",
  gameLabel: "Game",
  resultLabel: "Result",
  resultSuffix: (difficulty) => `(${difficulty} difficulty AI opponent)`,
  summary: (g, a, w) =>
    `\nPlayer context: ${g} games played, avg ${a} moves per game. Recent weaknesses: ${w}.`,
  noWeakness: "none identified yet",
  schemaPreamble:
    "Respond ONLY with a JSON object matching this exact schema (no markdown, no explanation outside JSON):",
  schemaSummary: "2-3 sentence conversational summary of the game",
  schemaWhy: "why",
  schemaLessons: "actionable lesson 1",
  schemaPraise: "specific thing done well",
  rulesHeader: "Rules:",
  rules: [
    "- mistakes: max 5, only include genuine mistakes",
    "- lessons: max 3, concrete and actionable",
    "- praise: max 2, specific to this game (never empty, find something positive even in a loss)",
    "- All text in English",
    "- Keep explanations simple. The player may be a beginner",
  ],
};

const INTRO_ES: IntroCopy = {
  intro:
    "Eres un coach de ajedrez analizando una partida jugada en Chesscito (una app de aprendizaje para principiantes y jugadores casuales).",
  gameLabel: "Partida",
  resultLabel: "Resultado",
  resultSuffix: (difficulty) => `(dificultad ${difficulty} contra IA)`,
  summary: (g, a, w) =>
    `\nContexto del jugador: ${g} partidas jugadas, promedio ${a} jugadas por partida. Debilidades recientes: ${w}.`,
  noWeakness: "ninguna identificada aún",
  schemaPreamble:
    "Responde ÚNICAMENTE con un objeto JSON que coincida exactamente con este esquema (sin markdown, sin explicación fuera del JSON):",
  schemaSummary: "resumen conversacional de 2-3 oraciones de la partida",
  schemaWhy: "por qué",
  schemaLessons: "lección accionable 1",
  schemaPraise: "algo específico hecho bien",
  rulesHeader: "Reglas:",
  rules: [
    "- mistakes: máximo 5, solo incluir errores reales",
    "- lessons: máximo 3, concretas y accionables",
    "- praise: máximo 2, específicas a esta partida (nunca vacío, encuentra algo positivo incluso en una derrota)",
    "- JSON property names MUST remain in English (kind, summary, mistakes, lessons, praise, moveNumber, played, better, explanation). Solo los VALORES de tipo string deben estar en español (es-MX).",
    "- Mantén las explicaciones simples. El jugador puede ser principiante",
  ],
};

const RESULT_LABEL_ES: Record<GameResult, string> = {
  win: "ganaste",
  lose: "perdiste",
  draw: "tablas",
  resigned: "te rendiste",
};

export function buildCoachPrompt(
  moves: string[],
  result: GameResult,
  difficulty: string,
  summary: PlayerSummary | null,
  history?: HistoryDigest | null,
  locale: CoachLocale = "en",
): string {
  const intro = locale === "es" ? INTRO_ES : INTRO_EN;
  const resultHints = locale === "es" ? RESULT_HINTS_ES : RESULT_HINTS_EN;
  const movesStr = moves.map((m, i) => `${Math.floor(i / 2) + 1}${i % 2 === 0 ? "." : "..."} ${m}`).join(" ");
  // EN: keep raw token to preserve the locked free-path snapshot.
  // ES: localize the result word so the LLM sees Spanish framing end-to-end.
  const resultToken = locale === "es" ? RESULT_LABEL_ES[result] : result;

  const summaryBlock = summary
    ? intro.summary(
        summary.gamesPlayed,
        Math.round(summary.avgGameLength),
        summary.weaknessTags.slice(0, 5).join(", ") || intro.noWeakness,
      )
    : "";

  const historyBlock = buildHistoryAugmentation(history, locale);

  return `${intro.intro}

${intro.gameLabel}: ${movesStr}
${intro.resultLabel}: ${resultToken} ${intro.resultSuffix(difficulty)}
${summaryBlock}${historyBlock}

${resultHints[result]}

${intro.schemaPreamble}
{
  "kind": "full",
  "summary": "${intro.schemaSummary}",
  "mistakes": [{"moveNumber": N, "played": "move", "better": "alternative", "explanation": "${intro.schemaWhy}"}],
  "lessons": ["${intro.schemaLessons}", ...],
  "praise": ["${intro.schemaPraise}", ...]
}

${intro.rulesHeader}
${intro.rules.join("\n")}`;
}
