#!/usr/bin/env bash
# API with auto-reload on :8000 and the Vite dev server on :5173 (proxies /api).
set -euo pipefail
cd "$(dirname "$0")/.."

.venv/bin/uvicorn backend.main:app --reload --port 8000 &
trap 'kill $!' EXIT
cd frontend && npm run dev
