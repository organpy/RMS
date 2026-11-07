"""Run the app: ``python -m backend [--open]`` (honours RMS_HOST / RMS_PORT).

``--open`` is what the double-click launchers use: it opens the browser once the
server answers, reuses an RMS that is already running, and moves to the next free
port when another program holds the configured one.
"""

import argparse
import json
import socket
import threading
import time
import urllib.request
import webbrowser

import uvicorn

from backend.core.config import get_settings
from backend.modules.network import service as network

PORT_TRIES = 20


def _local(host: str) -> str:
    """Address to reach the server from this computer (a wildcard bind is not connectable)."""
    return "127.0.0.1" if host in ("0.0.0.0", "::") else host


def _url(host: str, port: int) -> str:
    return f"http://{_local(host)}:{port}"


def _is_rms(url: str) -> bool:
    try:
        with urllib.request.urlopen(f"{url}/api/health", timeout=1) as r:
            return json.load(r).get("status") == "ok"
    except (OSError, ValueError):
        return False


def _free(host: str, port: int) -> bool:
    """Nothing is listening there. (A test bind would also fail on lingering closed connections.)"""
    try:
        with socket.create_connection((_local(host), port), timeout=0.5):
            return False
    except OSError:
        return True


def _open_when_ready(url: str) -> None:
    def wait() -> None:
        for _ in range(120):
            if _is_rms(url):
                webbrowser.open(url)
                return
            time.sleep(0.5)

    threading.Thread(target=wait, daemon=True).start()


def serve(port: int, quiet: bool) -> None:
    """Run the server; rebind and run again when the app asks (network access toggled in Settings)."""
    from backend.main import app

    while True:
        host = network.bind_host()
        server = uvicorn.Server(uvicorn.Config(app, host=host, port=port, proxy_headers=False, log_level="warning" if quiet else "info"))
        restart = threading.Event()

        def request_restart(server: uvicorn.Server = server, restart: threading.Event = restart) -> None:
            restart.set()
            server.should_exit = True

        app.state.restart, app.state.listening, app.state.port = request_restart, host, port
        server.run()
        if not restart.is_set():
            return
        where = "other devices on this network too" if network.lan_enabled() else "this computer only"
        print(f"  Restarting: RMS is now reachable from {where}.", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m backend", description="Run RMS.")
    parser.add_argument("--open", action="store_true", help="open the browser and pick a free port if needed")
    args = parser.parse_args()

    host, port = network.bind_host(), get_settings().port

    if args.open:
        for candidate in range(port, port + PORT_TRIES):
            if _is_rms(_url(host, candidate)):
                print(f"RMS is already running at {_url(host, candidate)} - opening it in your browser.", flush=True)
                webbrowser.open(_url(host, candidate))
                return
            if _free(host, candidate):
                if candidate != port:
                    print(f"Port {port} is used by another program, using {candidate} instead.", flush=True)
                port = candidate
                break
        else:
            raise SystemExit(f"No free port between {port} and {port + PORT_TRIES - 1}. Set RMS_PORT in the .env file.")
        url = _url(host, port)
        print(f"\n  RMS is starting at {url}\n  Keep this window open while you use it. Close it to stop RMS.\n", flush=True)
        _open_when_ready(url)

    serve(port, quiet=args.open)


if __name__ == "__main__":
    main()
