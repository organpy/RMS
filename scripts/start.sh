#!/usr/bin/env bash
# Install (first run), build the UI and serve everything from one process.
#   RMS_HOST=0.0.0.0 scripts/start.sh   # reachable from your local network
set -euo pipefail
cd "$(dirname "$0")/.."

[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
(cd frontend && npm ci --silent && npm run build --silent)
exec .venv/bin/python -m backend
