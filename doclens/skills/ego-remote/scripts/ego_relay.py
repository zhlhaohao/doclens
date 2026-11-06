"""Windows-side ego-browser relay.

Runs on the Windows host (where ego lite and ego-browser.exe live) and lets a
Linux container or WSL shell drive the real browser through a local-only HTTP
endpoint.

Endpoints
---------
POST /exec   body = JSON {"args": [...], "stdin": "..."}
              -> runs `ego-browser.exe <args>` with the given stdin
POST /run    body = raw script text
              -> runs `ego-browser.exe nodejs` with the body as stdin

Response: HTTP 200 with the combined stdout/stderr; header X-Exit-Code holds
the exit code. Requests without a valid token are rejected with 403.

Security
--------
The relay drives the user's real, logged-in browser, so it must never be open
to the LAN unauthenticated. It binds 0.0.0.0 (containers reach the host through
host.docker.internal), which means the shared token is the only barrier.

**Fail closed**: with no token configured, every request is rejected. An
unauthenticated relay is never started by accident.

Token resolution order:
1. ``EGO_RELAY_TOKEN`` environment variable
2. ``EGO_RELAY_TOKEN_FILE`` path (default: ``%LOCALAPPDATA%\\ego-relay\\token.txt``)
"""
import json
import os
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer


def _expand_user_home(p: str) -> str:
    """Expand %USERPROFILE% / ~ in a config path (no hard-coded username)."""
    if p.startswith("%"):
        p = os.path.expandvars(p)
    return os.path.expanduser(p)


def default_ego_browser() -> str:
    """Locate ego-browser.exe without hard-coding the Windows username."""
    override = os.environ.get("EGO_BROWSER_EXE")
    if override:
        return _expand_user_home(override)
    return _expand_user_home(
        r"%USERPROFILE%\.local\share\ego\active_version_dir\ego-browser.exe"
    )


EGO_BROWSER = default_ego_browser()
TIMEOUT = int(os.environ.get("EGO_RELAY_TIMEOUT", "300"))


def default_token_file() -> str:
    local_appdata = os.environ.get("LOCALAPPDATA") or os.path.expanduser(
        "~\\AppData\\Local"
    )
    return os.path.join(local_appdata, "ego-relay", "token.txt")


def load_token() -> str:
    """Resolve the shared secret; empty string means "reject everything"."""
    token = (os.environ.get("EGO_RELAY_TOKEN") or "").strip()
    if token:
        return token
    path = os.environ.get("EGO_RELAY_TOKEN_FILE") or default_token_file()
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read().strip()
    except OSError:
        return ""


def run_ego(args, stdin_text=None):
    cmd = [EGO_BROWSER] + list(args)
    kwargs = dict(
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=TIMEOUT,
    )
    if stdin_text is not None:
        kwargs["input"] = stdin_text
    try:
        proc = subprocess.run(cmd, **kwargs)
        return proc.returncode, (proc.stdout or "") + (proc.stderr or "")
    except FileNotFoundError:
        return 127, "ego-browser not found: %s\n" % EGO_BROWSER
    except subprocess.TimeoutExpired:
        return 124, "[relay] timeout after %ss\n" % TIMEOUT


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _reply(self, status, body):
        payload = body.encode("utf-8", "replace")
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("X-Exit-Code", str(status))
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        token = load_token()
        if not token:
            self._reply(
                403,
                "forbidden: relay has no token configured (set EGO_RELAY_TOKEN or "
                "EGO_RELAY_TOKEN_FILE)\n",
            )
            return
        if self.headers.get("X-Ego-Relay-Token", "") != token:
            self._reply(403, "forbidden: bad or missing relay token\n")
            return
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        if self.path == "/exec":
            try:
                req = json.loads(body.decode("utf-8"))
            except Exception as exc:
                self._reply(400, "bad json: %s\n" % exc)
                return
            status, out = run_ego(req.get("args", []), req.get("stdin"))
        elif self.path == "/run":
            status, out = run_ego(["nodejs"], body.decode("utf-8", "replace"))
        else:
            self._reply(404, "unknown path\n")
            return
        self._reply(status, out)

    def log_message(self, *args):
        sys.stderr.write("[relay] %s\n" % (args[0] % args[1:]))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 18777
    token = load_token()
    if not token:
        sys.stderr.write(
            "[relay] FATAL: no token configured — every request will be rejected.\n"
            "[relay] Set EGO_RELAY_TOKEN or write the secret to %s\n"
            % default_token_file()
        )
        sys.exit(2)
    srv = HTTPServer(("0.0.0.0", port), Handler)
    sys.stderr.write(
        "[relay] listening on 0.0.0.0:%d -> %s (token: file/env)\n"
        % (port, EGO_BROWSER)
    )
    srv.serve_forever()


if __name__ == "__main__":
    main()
