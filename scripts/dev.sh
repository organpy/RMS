#!/usr/bin/env bash
# API with auto-reload on :8000 and the Vite dev server on :5173 (proxies /api).
set -euo pipefail
cd "$(dirname "$0")/.."

# Same bind rule as the launcher: the Settings network toggle (or RMS_HOST). No live rebind here, restart to apply.
HOST=$(.venv/bin/python -c 'from backend.modules.network.service import bind_host; print(bind_host())')
.venv/bin/uvicorn backend.main:app --reload --host "$HOST" --port 8000 &
trap 'kill $!' EXIT
cd frontend && npm run dev
