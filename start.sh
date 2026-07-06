#!/usr/bin/env bash
#
# Screen Mirroring - Signaling Server + Receiver
# Bash port of start.bat
#
set -euo pipefail

# Directory this script lives in, so it works from any CWD (equivalent to %~dp0)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pick the right "open a file/URL" command for the current OS
case "$(uname -s)" in
    Darwin*) OPEN_CMD="open" ;;
    Linux*)  OPEN_CMD="xdg-open" ;;
    *)       OPEN_CMD="" ;;
esac

echo "================================"
echo "  Starting Screen Mirroring..."
echo "================================"
echo

# --- [1/2] Signaling server -------------------------------------------------
echo "[1/2] Starting Signaling Server (ws://0.0.0.0:8080)..."
(cd "$SCRIPT_DIR/signaling-server" && node server.js) &
SERVER_PID=$!

# Ensure the backgrounded server is stopped when this script exits (Ctrl-C, etc.)
cleanup() {
    echo
    echo "Stopping signaling server (pid $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# --- [2/2] PC receiver page -------------------------------------------------
echo "[2/2] Opening PC Receiver Page..."
if [ -n "$OPEN_CMD" ]; then
    "$OPEN_CMD" "$SCRIPT_DIR/web-receiver/index.html"
else
    echo "  Could not auto-open a browser on this OS."
    echo "  Please open: $SCRIPT_DIR/web-receiver/index.html"
fi

echo
echo "All ready!"
echo 'Open the Mirroring App on Mobile -> Click "Start Mirroring"'
echo
echo "Press Ctrl-C to stop the signaling server and exit."

# Keep the script alive so the trap can clean up the server on exit (like `pause`)
wait "$SERVER_PID"
