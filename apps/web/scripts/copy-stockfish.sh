#!/usr/bin/env bash
# copy-stockfish.sh
# Copies Stockfish WASM engine files from node_modules to public/engines/
# Supports: lila-stockfish-web, stockfish.wasm, stockfish, stockfish.js

set -e

DEST="$(dirname "$0")/../public/engines"
mkdir -p "$DEST"

if [ -d "node_modules/lila-stockfish-web" ]; then
  echo "Found: lila-stockfish-web"
  SRC="node_modules/lila-stockfish-web"
  cp "$SRC"/*.js "$DEST/"
  cp "$SRC"/*.wasm "$DEST/"
  echo "Copied lila-stockfish-web files to $DEST:"
  ls -lh "$DEST"
elif [ -d "node_modules/stockfish.wasm" ]; then
  echo "Found: stockfish.wasm"
  SRC="node_modules/stockfish.wasm"
  cp "$SRC"/*.js "$DEST/" 2>/dev/null || true
  cp "$SRC"/*.wasm "$DEST/" 2>/dev/null || true
  echo "Copied stockfish.wasm files to $DEST:"
  ls -lh "$DEST"
elif [ -d "node_modules/stockfish" ]; then
  echo "Found: stockfish"
  SRC="node_modules/stockfish"
  cp "$SRC"/*.js "$DEST/" 2>/dev/null || true
  cp "$SRC"/*.wasm "$DEST/" 2>/dev/null || true
  echo "Copied stockfish files to $DEST:"
  ls -lh "$DEST"
elif [ -d "node_modules/stockfish.js" ]; then
  echo "Found: stockfish.js"
  SRC="node_modules/stockfish.js"
  cp "$SRC"/*.js "$DEST/" 2>/dev/null || true
  cp "$SRC"/*.wasm "$DEST/" 2>/dev/null || true
  echo "Copied stockfish.js files to $DEST:"
  ls -lh "$DEST"
else
  echo "ERROR: No Stockfish package found in node_modules. Install one of: lila-stockfish-web, stockfish.wasm, stockfish, stockfish.js"
  exit 1
fi
