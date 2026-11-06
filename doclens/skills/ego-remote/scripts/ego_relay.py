"""Windows-side ego-browser relay.

Runs on the Windows host (where ego lite and ego-browser.exe live) and lets a
Linux container or WSL shell drive the real browser through a local HTTP
endpoint.

Endpoints
---------
POST /exec   body = JSON {"args": [...], "stdin": "..."}
              -> runs `ego-browser.exe <args>` with the given stdin
POST /run    body = raw script text
              -> runs `ego-browser.exe nodejs` with the body as stdin

Response: HTTP 200 with the combined stdout/stderr; header X-Exit-Code holds
the exit code.

Security
--------
The relay drives the user's real, logged-in browser. Two independent guards,
either alone is sufficient:

1. **Bind address** (``EGO_RELAY_BIND``, default ``127.0.0.1``): loopback-only
   means nothing outside this machine can connect at all. Containers reach the
   host through ``host.docker.internal`` (NATed to loopback by Docker Desktop /
   WSL2), so the default works for containers without exposing a LAN port.
2. **Shared token** (``EGO_RELAY_TOKEN`` env or ``EGO_RELAY_TOKEN_FILE``, default
   ``%LOCALAPPDATA%\\ego-relay\\token.txt``): required when binding a
   non-loopback address (e.g. ``0.0.0.0`` for LAN access). Binding non-loopback
   without a token refuses to start (fail closed).

Use loopback bind + firewall for single-user hosts; use 0.0.0.0 + token when
the relay must be reachable from other machines.
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


def load_token() -> str:
    """Resolve the shared secret; empty string means "not configured".

    Only EGO_RELAY_TOKEN / EGO_RELAY_TOKEN_FILE are consulted. There is no
    default token file: loopback-only deployments run tokenless, and a token
    exists only when explicitly provided.
    """
    return (os.environ.get("EGO_RELAY_TOKEN") or "").strip()


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
        # With a token configured, every request must carry it. Without one
        # (loopback-only mode), the bind address is the guard and requests pass.
        token = load_token()
        if token and self.headers.get("X-Ego-Relay-Token", "") != token:
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
    # Bind loopback by default; 0.0.0.0 only when the caller opts in.
    bind = _expand_user_home(os.environ.get("EGO_RELAY_BIND") or "127.0.0.1")
    token = load_token()
    if not token and bind not in ("127.0.0.1", "::1", "localhost"):
        # Non-loopback bind without a token: the port would be an unguarded
        # remote control for the user's browser on the LAN. Refuse to start.
        sys.stderr.write(
            "[relay] FATAL: binding %s without a token is not allowed.\n"
            "[relay] Set EGO_RELAY_TOKEN / EGO_RELAY_TOKEN_FILE, or bind 127.0.0.1.\n"
            % (bind,)
        )
        sys.exit(2)
    srv = HTTPServer((bind, port), Handler)
    mode = "token" if token else "loopback-only (no token)"
    sys.stderr.write(
        "[relay] listening on %s:%d -> %s (%s)\n" % (bind, port, EGO_BROWSER, mode)
    )
    srv.serve_forever()


if __name__ == "__main__":
    main()
