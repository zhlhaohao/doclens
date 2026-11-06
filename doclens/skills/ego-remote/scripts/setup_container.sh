#!/usr/bin/env bash
# Install the ego-browser shim inside a Linux container / WSL shell.
#
# The shim forwards ego-browser commands to the Windows-side relay. The shared
# secret is injected, not discovered from a shared volume: pass it via
# EGO_RELAY_TOKEN (env) or via a token file whose path is baked into the shim.
#
# Usage:
#   EGO_RELAY_TOKEN=<secret> ./setup_container.sh
#   EGO_RELAY_TOKEN_FILE=/etc/ego-relay/token ./setup_container.sh
#   ./setup_container.sh --print-token-path
#
# Env:
#   EGO_RELAY_URL     relay base URL (default http://host.docker.internal:18777)
#   EGO_RELAY_TOKEN   shared secret (preferred)
#   EGO_RELAY_TOKEN_FILE  token file path (default /etc/ego-relay/token)
#   EGO_SHIM_PATH     where to install the shim (default /usr/local/bin/ego-browser)
set -uo pipefail

SHIM_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/ego-browser.sh"
SHIM_PATH="${EGO_SHIM_PATH:-/usr/local/bin/ego-browser}"
TOKEN_FILE="${EGO_RELAY_TOKEN_FILE:-/etc/ego-relay/token}"
RELAY_URL="${EGO_RELAY_URL:-http://host.docker.internal:18777}"

if [ "${1:-}" = "--print-token-path" ]; then
  echo "$TOKEN_FILE"
  exit 0
fi

if [ ! -f "$SHIM_SRC" ]; then
  echo "ego-browser.sh not found next to this script: $SHIM_SRC" >&2
  exit 1
fi

mkdir -p "$(dirname "$SHIM_PATH")"
# Strip CRLF: a CRLF shebang makes the kernel look for "bash\r".
sed 's/\r$//' "$SHIM_SRC" > "$SHIM_PATH"
chmod 0755 "$SHIM_PATH"
echo "installed shim -> $SHIM_PATH"

# --- token injection (optional; not needed for loopback-only relay) ---------
have_token=0
if [ -n "${EGO_RELAY_TOKEN:-}" ]; then
  mkdir -p "$(dirname "$TOKEN_FILE")"
  printf '%s' "$EGO_RELAY_TOKEN" > "$TOKEN_FILE"
  chmod 0600 "$TOKEN_FILE"
  have_token=1
  echo "wrote token to $TOKEN_FILE (from EGO_RELAY_TOKEN)"
elif [ -r "$TOKEN_FILE" ]; then
  have_token=1
  echo "using existing token file $TOKEN_FILE"
else
  echo "no token provided — OK if the relay binds 127.0.0.1 (default; guarded by"
  echo "firewall). Required only if the relay binds 0.0.0.0 for LAN access."
fi

# The shim reads the token from EGO_RELAY_TOKEN first, then from the token
# file. Bake the file path in so the shim works without env plumbing.
if ! grep -q "EGO_RELAY_TOKEN_FILE" "$SHIM_PATH" 2>/dev/null; then
  echo "note: shim does not read EGO_RELAY_TOKEN_FILE; exporting EGO_RELAY_TOKEN"
  echo "      in the container environment is required." >&2
fi

# --- verify -----------------------------------------------------------------
echo ""
echo "verifying relay reachability at $RELAY_URL ..."
if "$SHIM_PATH" --version; then
  echo "OK — ego-browser is reachable from this environment"
else
  echo "FAILED — relay not reachable. Check:" >&2
  echo "  - the relay task is running on the Windows host" >&2
  echo "  - EGO_RELAY_URL matches the relay's host:port" >&2
  if [ "$have_token" = "1" ]; then
    echo "  - the token matches the one on the Windows side" >&2
  fi
  exit 1
fi
