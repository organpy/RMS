"""Build the downloadable release: a zip with the interface pre-built, so end users need only Python.

Usage:  python -m scripts.package [--version 1.0.0] [--skip-build]
Writes  release/RMS-<version>.zip  with everything under a top-level RMS/ folder.
"""

import argparse
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Development-only paths; the frontend ships as its build output only.
EXCLUDE = ("tests/", "e2e/", "frontend/", ".github/", "scripts/release/", "requirements-dev.txt", "pytest.ini", ".gitattributes")
EXECUTABLE = (".command", ".sh")


def _run(*cmd: str, cwd: Path = ROOT) -> str:
    return subprocess.run(cmd, cwd=cwd, check=True, capture_output=True, text=True, shell=sys.platform == "win32").stdout.strip()


def _files() -> list[Path]:
    tracked = _run("git", "ls-files").splitlines()
    files = [ROOT / f for f in tracked if not f.startswith(EXCLUDE) and (ROOT / f).is_file()]
    dist = ROOT / "frontend" / "dist"
    return files + sorted(p for p in dist.rglob("*") if p.is_file())


def _add(zf: zipfile.ZipFile, path: Path, arcname: str) -> None:
    info = zipfile.ZipInfo.from_file(path, arcname)
    info.external_attr = (0o755 if arcname.endswith(EXECUTABLE) else 0o644) << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    zf.writestr(info, path.read_bytes())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--version", default=None, help="defaults to git describe")
    parser.add_argument("--skip-build", action="store_true", help="reuse the existing frontend/dist")
    args = parser.parse_args()

    version = args.version or _run("git", "describe", "--tags", "--always", "--dirty")
    if not args.skip_build:
        print("Building the interface...")
        _run("npm", "ci", cwd=ROOT / "frontend")
        _run("npm", "run", "build", cwd=ROOT / "frontend")
    if not (ROOT / "frontend" / "dist" / "index.html").exists():
        raise SystemExit("frontend/dist is missing: run without --skip-build")

    out = ROOT / "release" / f"RMS-{version}.zip"
    out.parent.mkdir(exist_ok=True)
    files = _files()
    with zipfile.ZipFile(out, "w") as zf:
        for path in files:
            _add(zf, path, f"RMS/{path.relative_to(ROOT).as_posix()}")
        _add(zf, ROOT / "scripts" / "release" / "START-HERE.txt", "RMS/START-HERE.txt")
        zf.writestr("RMS/VERSION", f"{version}\n")  # shown in Settings and stored in backups
    print(f"{out.relative_to(ROOT)}  ({len(files) + 1} files, {out.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
