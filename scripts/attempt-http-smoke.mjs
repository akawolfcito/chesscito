/**
 * Slice 3 / 4C-3 — HTTP smoke against a REAL production build.
 *
 * What only this can answer: that a carril-2 attempt (one whose piece score
 * does NOT move) reaches the endpoint, comes back `duplicate` on the score row
 * while still writing its own attempt row, that the stars are computed
 * SERVER-side, that it costs exactly one unit of session budget, and that a
 * retry of the same attemptId costs zero.
 *
 * Nothing here is mocked. The session is a real challenge + EIP-191 signature
 * from a throwaway key (no funds needed — it only signs).
 *
 * HOW TO RUN (cwd must be apps/web, so `viem` resolves):
 *
 *   supabase start
 *   pnpm build
 *   # SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from `supabase status -o env`
 *   pnpm exec next start -p 3009
 *   pnpm --dir apps/web exec node ../../scripts/attempt-http-smoke.mjs
 *
 * Then read the DB back — the script does NOT assert against it, on purpose:
 * what it proves is the wire, and the storage claim has to be a separate look
 * so a bug cannot report itself.
 *
 *   select attempt_index, exercise_id, measure_kind, measure_value,
 *          grade_status, stars_earned, attempt_id_source
 *     from score_attempts where wallet = lower('<WALLET printed below>');
 *   select used_saves, max_saves from score_write_sessions where wallet = …;
 *   select save_id from score_saves where wallet = …;
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:3009";
const LEVEL_ID = 1; // rook
const SCORE = 300;

const account = privateKeyToAccount(generatePrivateKey());
const wallet = account.address;

const out = [];
function log(...a) {
  const line = a.join(" ");
  out.push(line);
  console.log(line);
}

async function post(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      // No Origin header on purpose: MiniPay's WebView omits it on same-site
      // fetches, so absent-and-logged is the shape production actually sees.
      // The token gate is what authenticates, not this.
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-json */
  }
  return { status: res.status, json };
}

function mintAttemptId() {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const challenge = await post("/api/scores/session/challenge", {
  wallet,
  surface: "learn",
});
if (challenge.status !== 200) {
  log("FAIL challenge", challenge.status, JSON.stringify(challenge.json));
  process.exit(1);
}

const signature = await account.signMessage({ message: challenge.json.message });
const authorized = await post("/api/scores/session/authorize", {
  message: challenge.json.message,
  signature,
});
if (authorized.status !== 200) {
  log("FAIL authorize", authorized.status, JSON.stringify(authorized.json));
  process.exit(1);
}
const token = authorized.json.token;
log(`session ok · maxSaves=${authorized.json.maxSaves}`);
log(`wallet ${wallet}`);

/** Every save carries the SAME score on purpose: the first writes the score
 *  row, everything after it is a `duplicate` — which is exactly the carril-2
 *  steady state, and the case where the attempt row is the only new fact. */
const results = [];

// 1. Carril 1 — an exercise. Creates the score row.
const a1 = mintAttemptId();
results.push([
  "carril-1 exercise",
  await post(
    "/api/scores/save",
    {
      levelId: LEVEL_ID,
      score: SCORE,
      timeMs: 12000,
      attemptId: a1,
      exerciseId: "rook-1",
      measurement: { kind: "moves", movesUsed: 1 },
    },
    token,
  ),
]);

// 2. Carril 2 — a labyrinth, same score. The score row already exists.
const a2 = mintAttemptId();
results.push([
  "carril-2 labyrinth",
  await post(
    "/api/scores/save",
    {
      levelId: LEVEL_ID,
      score: SCORE,
      timeMs: 30000,
      attemptId: a2,
      exerciseId: "rook-rail-two-turns",
      measurement: { kind: "moves", movesUsed: 8 },
    },
    token,
  ),
]);

// 3. The retry: the SAME attemptId. Must be a replay that spends nothing.
results.push([
  "carril-2 RETRY (same id)",
  await post(
    "/api/scores/save",
    {
      levelId: LEVEL_ID,
      score: SCORE,
      timeMs: 30000,
      attemptId: a2,
      exerciseId: "rook-rail-two-turns",
      measurement: { kind: "moves", movesUsed: 8 },
    },
    token,
  ),
]);

// 4. A second real carril-2 attempt, to prove the budget moves with ATTEMPTS
//    and not with requests.
const a3 = mintAttemptId();
results.push([
  "carril-2 second run",
  await post(
    "/api/scores/save",
    {
      levelId: LEVEL_ID,
      score: SCORE,
      timeMs: 41000,
      attemptId: a3,
      exerciseId: "rook-rail-two-turns",
      measurement: { kind: "moves", movesUsed: 12 },
    },
    token,
  ),
]);

for (const [label, r] of results) {
  const a = r.json?.attempt;
  log(
    `${label.padEnd(26)} → ${r.status} ${String(r.json?.status).padEnd(10)}` +
      ` stars=${a ? String(a.starsEarned) : "-"}` +
      ` grade=${a ? a.gradeStatus : "-"}` +
      ` replayed=${a ? a.replayed : "-"}` +
      ` idx=${a ? a.attemptIndex : "-"}` +
      ` freeUsed=${r.json?.quota?.freeUsed ?? "-"}`,
  );
}

log("");
log(`ATTEMPT_IDS ${a1} ${a2} ${a3}`);
log(`WALLET ${wallet}`);
