import type { StatsLocale } from "./locale";

/**
 * Every user-facing string on `/stats`, in both languages.
 *
 * ⛔ Language brief: this copy NEVER says "on-chain", "NFT" or "mint". The
 * on-chain block is "Saved on Celo". `pnpm content:audit` enforces the same
 * rule across the app; this file is written to pass it by construction.
 *
 * The two records are asserted to have identical key sets by a test — a
 * missing key would render `undefined` on a public page, which is how a
 * top-level spread once printed raw key paths to Spanish readers.
 */
export type StatsCopy = {
  title: string;
  intro: string;
  back: string;

  filterSurface: string;
  filterContainer: string;
  all: string;
  learn: string;
  play: string;
  minipay: string;
  browser: string;
  total: string;

  sectionSummary: string;
  sectionBreakdown: string;
  sectionActivation: string;
  sectionAccess: string;
  sectionRetention: string;
  sectionHabit: string;
  sectionLifecycle: string;
  sectionTrend: string;
  sectionCountries: string;
  sectionCelo: string;
  sectionPlayers: string;
  sectionMethod: string;

  sessions7d: string;
  sessions30d: string;
  appOpenSessions: string;
  appOpensRows: string;
  approximate: string;
  approximateNote: string;

  activationNote: string;
  accessNote: string;
  accessFailed: string;

  retentionD1: string;
  retentionD7: string;
  retentionWeek3: string;
  notEnoughHistory: string;
  ofCohort: string;

  habitCohort: string;
  habitMedian: string;
  habitBucket: string;

  known: string;
  newToday: string;
  new7d: string;
  active7d: string;
  dormant: string;
  inactive: string;
  resurrected7d: string;

  trendSessions: string;
  trendNew: string;
  trendReturning: string;

  country: string;
  countrySessions: string;

  celoUniquePlayers: string;
  celoVictories: string;
  celoPackPurchases: string;
  celoScoreSaves: string;
  celoWelcomePacks: string;
  lifetime: string;
  last30d: string;
  last7d: string;

  playersTotal: string;
  playersUnavailable: string;
  playersRank: string;
  playersScore: string;

  surfaceNullNote: string;
  integrityTitle: string;
  integrityBody: string;
  sharedDbNote: string;
  snapshotAt: string;
  censusAt: string;
  notMeasured: string;
  methodBody: string;
};

const EN: StatsCopy = {
  title: "Chesscito Stats",
  intro: "Live activity across Chesscito Learn and Chesscito Play.",
  back: "← Back",

  filterSurface: "Product",
  filterContainer: "App",
  all: "All",
  learn: "Learn",
  play: "Play",
  minipay: "MiniPay",
  browser: "Browser",
  total: "Total",

  sectionSummary: "Summary",
  sectionBreakdown: "Learn / Play breakdown",
  sectionActivation: "Activation",
  sectionAccess: "Access journey",
  sectionRetention: "Retention",
  sectionHabit: "Habit depth",
  sectionLifecycle: "People",
  sectionTrend: "Last 30 days",
  sectionCountries: "Top countries",
  sectionCelo: "Saved on Celo",
  sectionPlayers: "Players",
  sectionMethod: "How these numbers are measured",

  sessions7d: "Sessions (7d)",
  sessions30d: "Sessions (30d)",
  appOpenSessions: "App opens (30d)",
  appOpensRows: "App open events (30d)",
  approximate: "approx.",
  approximateNote:
    "Counts events, not sessions, and the event stream contains exact duplicates — read it as an upper bound.",

  activationNote:
    "Each step counts only sessions that completed every step before it, so the sequence can only go down.",
  accessNote:
    "These are checkpoints, not a strict funnel. A session can reach a later checkpoint without recording an earlier one, so a number here may be higher than the one above it. That is expected, not an error.",
  accessFailed: "Sessions with a sign-in error",

  retentionD1: "Day 1",
  retentionD7: "Day 7",
  retentionWeek3: "Days 15–21",
  notEnoughHistory: "Not enough history yet",
  ofCohort: "of",

  habitCohort: "Active installs",
  habitMedian: "Median active days",
  habitBucket: "day(s) or more",

  known: "People known",
  newToday: "New today",
  new7d: "New (rolling 7d)",
  active7d: "Active (rolling 7d)",
  dormant: "Dormant (8–30d)",
  inactive: "Inactive (30d+)",
  resurrected7d: "Came back (7d)",

  trendSessions: "Sessions",
  trendNew: "New installs",
  trendReturning: "Returning",

  country: "Country",
  countrySessions: "Sessions (30d)",

  celoUniquePlayers: "Players with activity saved on Celo",
  celoVictories: "Victories saved",
  celoPackPurchases: "Peones packs",
  celoScoreSaves: "Scores saved",
  celoWelcomePacks: "Welcome packs",
  lifetime: "All time",
  last30d: "30d",
  last7d: "7d",

  playersTotal: "Ranked players",
  playersUnavailable: "The players table could not be read right now.",
  playersRank: "#",
  playersScore: "Score",

  surfaceNullNote:
    "Learn and Play exclude activity without a recorded surface, so their sum may be lower than Total.",
  integrityTitle: "Some numbers are unavailable",
  integrityBody:
    "These measurements could not be read for this snapshot and show as “—”:",
  sharedDbNote:
    "Figures combine the production and preview environments, which share one database.",
  snapshotAt: "Snapshot taken",
  censusAt: "Players list as of",
  notMeasured: "Not measured",
  methodBody:
    "Sessions are anonymous installs, identified by a random id stored on the device — not by wallet, so one person on two devices counts twice. People are counted with a one-way key derived at ingest. All windows are rolling, measured back from the moment the snapshot was taken, except “New today”, which is the current UTC calendar day. Every count is computed in the database; nothing on this page is derived from a partial download. A dash means the measurement was unavailable — never that the value is zero.",
};

const ES: StatsCopy = {
  title: "Estadísticas de Chesscito",
  intro: "Actividad en vivo de Chesscito Learn y Chesscito Play.",
  back: "← Volver",

  filterSurface: "Producto",
  filterContainer: "App",
  all: "Todo",
  learn: "Learn",
  play: "Play",
  minipay: "MiniPay",
  browser: "Navegador",
  total: "Total",

  sectionSummary: "Resumen",
  sectionBreakdown: "Desglose Learn / Play",
  sectionActivation: "Activación",
  sectionAccess: "Recorrido de acceso",
  sectionRetention: "Retención",
  sectionHabit: "Profundidad del hábito",
  sectionLifecycle: "Personas",
  sectionTrend: "Últimos 30 días",
  sectionCountries: "Países principales",
  sectionCelo: "Guardado en Celo",
  sectionPlayers: "Jugadores",
  sectionMethod: "Cómo se miden estos números",

  sessions7d: "Sesiones (7d)",
  sessions30d: "Sesiones (30d)",
  appOpenSessions: "Aperturas de la app (30d)",
  appOpensRows: "Eventos de apertura (30d)",
  approximate: "aprox.",
  approximateNote:
    "Cuenta eventos, no sesiones, y el flujo contiene duplicados exactos: leerlo como cota superior.",

  activationNote:
    "Cada paso cuenta solo las sesiones que completaron todos los anteriores, así que la secuencia solo puede bajar.",
  accessNote:
    "Son puntos de control, no un embudo estricto. Una sesión puede alcanzar un punto posterior sin registrar uno anterior, así que un número puede ser mayor que el de arriba. Es esperado, no un error.",
  accessFailed: "Sesiones con error de inicio de sesión",

  retentionD1: "Día 1",
  retentionD7: "Día 7",
  retentionWeek3: "Días 15–21",
  notEnoughHistory: "Aún no hay suficiente historial",
  ofCohort: "de",

  habitCohort: "Instalaciones activas",
  habitMedian: "Mediana de días activos",
  habitBucket: "día(s) o más",

  known: "Personas conocidas",
  newToday: "Nuevas hoy",
  new7d: "Nuevas (7d móviles)",
  active7d: "Activas (7d móviles)",
  dormant: "Inactivas (8–30d)",
  inactive: "Sin actividad (30d+)",
  resurrected7d: "Volvieron (7d)",

  trendSessions: "Sesiones",
  trendNew: "Instalaciones nuevas",
  trendReturning: "Recurrentes",

  country: "País",
  countrySessions: "Sesiones (30d)",

  celoUniquePlayers: "Jugadores con actividad guardada en Celo",
  celoVictories: "Victorias guardadas",
  celoPackPurchases: "Paquetes de Peones",
  celoScoreSaves: "Puntajes guardados",
  celoWelcomePacks: "Paquetes de bienvenida",
  lifetime: "Histórico",
  last30d: "30d",
  last7d: "7d",

  playersTotal: "Jugadores en el ranking",
  playersUnavailable: "La tabla de jugadores no se pudo leer en este momento.",
  playersRank: "#",
  playersScore: "Puntaje",

  surfaceNullNote:
    "Learn y Play excluyen la actividad sin producto registrado, así que su suma puede ser menor que el Total.",
  integrityTitle: "Algunos números no están disponibles",
  integrityBody:
    "Estas mediciones no se pudieron leer para esta foto y aparecen como «—»:",
  sharedDbNote:
    "Las cifras combinan los entornos de producción y preview, que comparten una misma base de datos.",
  snapshotAt: "Foto tomada",
  censusAt: "Lista de jugadores al",
  notMeasured: "Sin medir",
  methodBody:
    "Las sesiones son instalaciones anónimas, identificadas por un id aleatorio guardado en el dispositivo — no por wallet, así que una misma persona en dos dispositivos cuenta dos veces. Las personas se cuentan con una clave de una sola vía derivada al ingerir el evento. Todas las ventanas son móviles, medidas hacia atrás desde el momento de la foto, salvo «Nuevas hoy», que es el día calendario UTC en curso. Cada conteo se calcula en la base de datos; nada de esta página se deriva de una descarga parcial. Un guion significa que la medición no estuvo disponible — nunca que el valor sea cero.",
};

export const STATS_COPY: Record<StatsLocale, StatsCopy> = { en: EN, es: ES };

export function statsCopy(locale: StatsLocale): StatsCopy {
  return STATS_COPY[locale] ?? EN;
}

/** The em-dash the whole page uses for "not measured". One constant so a
 *  hyphen can never sneak in beside it and read as a minus sign. */
export const EM_DASH = "—";

/** Locale-aware thousands separators. `null` is the ONLY thing that becomes a
 *  dash — `0` is a real measurement and prints as `0`. */
export function formatCount(
  value: number | null | undefined,
  locale: StatsLocale,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EM_DASH;
  }
  return new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-US").format(value);
}
