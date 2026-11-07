#!/usr/bin/env bash
# Double-click on macOS (or run ./"Start RMS.command" on Linux) to install on first
# run and start RMS, then open it in the browser. Everything stays in this folder.
set -uo pipefail
cd "$(dirname "$0")" || exit 1

fail() { printf '\n  %s\n\n' "$1"; read -rp "  Press Enter to close." _; exit 1; }

find_python() {
  for c in python3.13 python3.12 python3.11 python3 python; do
    if command -v "$c" >/dev/null && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
      echo "$c"; return 0
    fi
  done
  return 1
}

if [ -x .venv/bin/python ] && ! .venv/bin/python -c 'import sys' 2>/dev/null; then
  echo "The Python environment in .venv is broken, rebuilding it..."; rm -rf .venv
fi

if [ ! -x .venv/bin/python ]; then
  printf '\n  First run: setting RMS up. This takes a minute or two and needs internet.\n\n'
  PY=$(find_python) || {
    command -v open >/dev/null && open "https://www.python.org/downloads/"
    fail "RMS needs Python 3.11 or newer. Install it from https://www.python.org/downloads/ and run this again."
  }
  "$PY" -m venv .venv || fail "Could not create the Python environment (on Debian/Ubuntu: sudo apt install python3-venv)."
fi

if ! cmp -s requirements.txt .venv/installed-requirements.txt; then
  echo "  Installing the Python packages RMS uses..."
  .venv/bin/python -m pip install --disable-pip-version-check -q -r requirements.txt \
    || fail "Installing packages failed. Check your internet connection and run this again."
  cp requirements.txt .venv/installed-requirements.txt
fi

if [ ! -f frontend/dist/index.html ]; then
  command -v npm >/dev/null || fail "The interface is not built in this copy. Download the release zip, which includes it, or install Node.js 20+."
  echo "  Building the interface (developer copy)..."
  (cd frontend && npm ci --silent && npm run build --silent) || fail "Building the interface failed. See the messages above."
fi

.venv/bin/python -m backend --open || fail "RMS stopped with an error. See the messages above."
