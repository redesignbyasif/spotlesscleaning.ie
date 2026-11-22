#!/usr/bin/env bash
# Local preview server for QA. Usage: ./serve.sh [port]
set -euo pipefail
PORT="${1:-8080}"
cd "$(dirname "$0")"
echo "Serving $(pwd) on http://0.0.0.0:${PORT}/"
python3 -m http.server "$PORT" --bind 0.0.0.0
