"""
Repository secret scanner to prevent accidental commits of API keys or tokens.
Scans git-tracked files (excluding binary assets) for known secret patterns.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("Google API Key", re.compile(r"AIza[0-9A-Za-z\-_]{35}")),
    ("OpenAI Key", re.compile(r"sk-[A-Za-z0-9]{20,}")),
    ("CARTO Key", re.compile(r"cb1_[A-Za-z0-9_]{16,}")),
    ("JWT Token", re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")),
    ("AWS Access Key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("Private Key Header", re.compile(r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----")),
]

SKIP_EXTENSIONS = {".png", ".jpg", ".jpeg", ".npz", ".geojson", ".ico", ".woff2"}
SKIP_PATHS = {"docs/AUDIT.md"}


def get_tracked_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files"],
        capture_output=True,
        text=True,
        check=True,
    )
    return [Path(line.strip()) for line in result.stdout.splitlines() if line.strip()]


def scan_files(files: list[Path]) -> list[str]:
    findings: list[str] = []
    for path in files:
        norm = path.as_posix()
        if norm in SKIP_PATHS or path.suffix.lower() in SKIP_EXTENSIONS:
            continue
        if not path.is_file():
            continue
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for lineno, line in enumerate(content.splitlines(), start=1):
            for label, pattern in SECRET_PATTERNS:
                if pattern.search(line):
                    findings.append(f"{norm}:{lineno}: potential {label} detected")
    return findings


def main() -> int:
    files = [Path(arg) for arg in sys.argv[1:]] if len(sys.argv) > 1 else get_tracked_files()
    findings = scan_files(files)
    if findings:
        print("SECRET SCAN FAILED:")
        for item in findings:
            print(f"  - {item}")
        return 1
    print(f"Secret scan passed ({len(files)} files checked).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
