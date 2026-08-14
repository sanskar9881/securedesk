#!/usr/bin/env bash
# Start the SecureDesk API for local development.
#
#   ./run.sh            # hot-reload, watching only our own source
#   ./run.sh --no-reload
#
# Why the explicit --reload-dir list: uvicorn's watcher defaults to the whole
# working directory, which includes venv/. Any pip install then triggers an
# endless reload loop. Scoping the watcher to our packages fixes that.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8000}"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use by:"
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN | tail -n +2
  echo
  echo "Stop it with:  pkill -f 'uvicorn main:app'    (or run: PORT=8001 ./run.sh)"
  exit 1
fi

if [ ! -x venv/bin/uvicorn ]; then
  echo "venv missing or incomplete. Create it with:"
  echo "  python3.11 -m venv venv && ./venv/bin/pip install -r requirements.txt"
  exit 1
fi

if [ "${1:-}" = "--no-reload" ]; then
  exec ./venv/bin/uvicorn main:app --host 127.0.0.1 --port "$PORT"
fi

exec ./venv/bin/uvicorn main:app --host 127.0.0.1 --port "$PORT" --reload \
  --reload-dir routes --reload-dir services --reload-dir core --reload-dir ml \
  --reload-include '*.py'
