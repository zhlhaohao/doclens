#!/usr/bin/env bash
# ego-browser shim for Linux containers / WSL shells.
#
# Forwards to the Windows-side ego relay, which runs the real ego-browser.exe
# and drives the user's logged-in ego lite browser.
#
# Usage:
#   ego-browser nodejs < task.mjs
#   ego-browser nodejs -e '...'
#   ego-browser --version | skill | import list | help
#
# Env:
#   EGO_RELAY_URL       relay base URL (default http://host.docker.internal:18777)
#   EGO_RELAY_TOKEN     shared secret (takes precedence)
#   EGO_RELAY_TOKEN_FILE  token file path (default /etc/ego-relay/token)
set -uo pipefail

RELAY="${EGO_RELAY_URL:-http://host.docker.internal:18777}"
TOKEN_FILE="${EGO_RELAY_TOKEN_FILE:-/etc/ego-relay/token}"

resolve_token() {
  if [ -n "${EGO_RELAY_TOKEN:-}" ]; then
    printf '%s' "$EGO_RELAY_TOKEN"
    return
  fi
  if [ -r "$TOKEN_FILE" ]; then
    cat "$TOKEN_FILE"
  fi
}

TMP_BODY="$(mktemp)"
TMP_HEAD="$(mktemp)"
trap 'rm -f "$TMP_BODY" "$TMP_HEAD"' EXIT

# relay_request <endpoint> <body-file|-> [content-type]
# Prints the relay body on stdout, returns the ego exit code.
relay_request() {
  local endpoint="$1" body="$2" ctype="${3:-application/octet-stream}"
  local token args ego_rc rc
  token="$(resolve_token)"
  args=(-sS -m 300 -X POST -D "$TMP_HEAD" -o "$TMP_BODY"
        -H "X-Ego-Relay-Token: $token")
  if [ "$ctype" != "application/octet-stream" ]; then
    args+=(-H "Content-Type: $ctype")
  fi
  if [ "$body" = "-" ]; then
    args+=(--data-binary @-)
  else
    args+=(--data-binary "@$body")
  fi
  curl "${args[@]}" "$RELAY/$endpoint"
  rc=$?
  cat "$TMP_BODY"
  if [ "$rc" -ne 0 ]; then
    return "$rc"
  fi
  # The relay reports the ego-browser exit code in a header.
  ego_rc="$(tr -d '\r' < "$TMP_HEAD" | awk 'tolower($1) == "x-exit-code:" {print $2}')"
  if [ -n "${ego_rc:-}" ]; then
    return "$ego_rc"
  fi
  return 0
}

if [ "$#" -eq 0 ]; then
  # No args: the relay runs `nodejs` with the piped script.
  relay_request run -
  exit $?
fi

if [ "$1" = "nodejs" ]; then
  shift
  if [ "$#" -eq 0 ]; then
    relay_request run -
    exit $?
  fi
  if [ "$1" = "-e" ] || [ "$1" = "--eval" ]; then
    printf '%s' "${2:-}" | relay_request run -
    exit $?
  fi
fi

# Everything else (--version, skill, help, import ...) is a plain CLI call.
payload="$(python3 - "$@" <<'PY'
import json, sys
print(json.dumps({"args": sys.argv[1:]}))
PY
)"
printf '%s' "$payload" | relay_request exec - application/json
exit $?
