/// <reference lib="webworker" />

// This file runs as a Web Worker (module type).
// It loads Stockfish WASM via dynamic import and communicates via postMessage.

type SearchMessage = {
  type: "search";
  fen: string;
  difficulty: "easy" | "medium" | "hard";
};

type InMessage = SearchMessage | { type: "init" };

type OutMessage =
  | { type: "ready" }
  | { type: "bestmove"; move: string }
  | { type: "error"; message: string };

const DIFFICULTY_CONFIG = {
  easy: { depth: 2, skillLevel: 0, elo: 400 },
  medium: { depth: 8, skillLevel: 10, elo: 1200 },
  hard: { depth: 15, skillLevel: 20, elo: 2000 },
} as const;

let engine: { uci: (cmd: string) => void } | null = null;
let uciReady = false;
let resolveMove: ((move: string) => void) | null = null;
// Queue search requests that arrive before UCI is ready
let pendingSearch: { fen: string; difficulty: SearchMessage["difficulty"] } | null = null;

function postOut(msg: OutMessage) {
  self.postMessage(msg);
}

function handleLine(line: string) {
  // UCI protocol initialization
  if (line === "uciok") {
    engine?.uci("isready");
    return;
  }

  if (line === "readyok") {
    if (!uciReady) {
      uciReady = true;
      postOut({ type: "ready" });
      // If a search was queued while initializing, run it now
      if (pendingSearch) {
        const { fen, difficulty } = pendingSearch;
        pendingSearch = null;
        search(fen, difficulty);
      }
    }
    return;
  }

  // Best move response
  if (line.startsWith("bestmove")) {
    const move = line.split(" ")[1];
    if (move && resolveMove) {
      const cb = resolveMove;
      resolveMove = null;
      cb(move);
    }
  }
}

async function initEngine() {
  try {
    // Dynamic import of the Stockfish ES module from public/engines/
    // @ts-expect-error — runtime URL served from public/, not a TS module
    const mod = await import(/* webpackIgnore: true */ "/engines/sf171-79.js");
    const StockfishFactory = mod.default;

    const sf = await StockfishFactory({
      listen: (line: string) => handleLine(line),
      onError: (err: string) => console.error("Stockfish error:", err),
    });

    engine = sf;

    // Start UCI protocol handshake — "ready" is sent when we receive "readyok"
    sf.uci("uci");
  } catch (err) {
    postOut({ type: "error", message: `Engine load failed: ${err}` });
  }
}

function search(fen: string, difficulty: SearchMessage["difficulty"]) {
  if (!engine) {
    postOut({ type: "error", message: "Engine not initialized" });
    return;
  }

  const config = DIFFICULTY_CONFIG[difficulty];

  engine.uci(`setoption name Skill Level value ${config.skillLevel}`);
  engine.uci(`setoption name UCI_LimitStrength value true`);
  engine.uci(`setoption name UCI_Elo value ${config.elo}`);
  engine.uci(`position fen ${fen}`);
  engine.uci(`go depth ${config.depth}`);

  const timeoutId = setTimeout(() => {
    if (resolveMove) {
      resolveMove = null;
      postOut({ type: "error", message: "AI timed out" });
    }
  }, 10_000);

  resolveMove = (move: string) => {
    clearTimeout(timeoutId);
    postOut({ type: "bestmove", move });
  };
}

self.onmessage = (e: MessageEvent<InMessage>) => {
  const msg = e.data;
  switch (msg.type) {
    case "init":
      initEngine();
      break;
    case "search":
      if (uciReady && engine) {
        search(msg.fen, msg.difficulty);
      } else if (engine && !uciReady) {
        // Engine loaded but UCI not ready yet — queue it
        pendingSearch = { fen: msg.fen, difficulty: msg.difficulty };
      } else {
        postOut({ type: "error", message: "Engine not ready" });
      }
      break;
  }
};
