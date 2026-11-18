#!/usr/bin/env python3
"""One-time interactive initialization of the physics service credentials.

Run from a trusted server TTY as root. Never run this through a batch command
runner: getpass must read directly from the operator's terminal.
"""

import getpass
import os
from pathlib import Path
import re
import secrets
import stat
import subprocess
import sys
import tempfile
import termios
import warnings


ENV_FILE = Path("/etc/physics-lab/physics-lab.env")
DATABASE_FILE = Path("/var/lib/physics-lab/data/physics-lab.sqlite")
EXPECTED = {
    "PHYSICS_BOOTSTRAP_SCHOOL_NAME": "",
    "PHYSICS_BOOTSTRAP_ADMIN_NAME": "",
    "PHYSICS_BOOTSTRAP_ADMIN_PASSWORD": "",
    "PHYSICS_API_TOKEN_SECRET": "__REPLACE_WITH_PRIVATE_RANDOM_64_HEX__",
}
EMAIL_RE = re.compile(r"[^\s@=]+@[^\s@=]+\.[^\s@=]+\Z")
PASSWORD_RE = re.compile(r"[A-Za-z0-9_@.!-]{16,200}\Z")


def replace_one_line(content: str, key: str, old: str, new: str) -> str:
    before = f"{key}={old}\n"
    if content.count(before) != 1:
        raise ValueError(f"{key} is not in the expected initial state")
    return content.replace(before, f"{key}={new}\n", 1)


def require_controlled_tty() -> None:
    """Check echo can be controlled without wrapping a non-seekable tty in r+."""
    fd = os.open("/dev/tty", os.O_RDWR | os.O_NOCTTY)
    try:
        termios.tcgetattr(fd)
    finally:
        os.close(fd)


def initialize(
    env_file: Path = ENV_FILE,
    database_file: Path = DATABASE_FILE,
    *,
    require_root: bool = True,
    check_service: bool = True,
) -> None:
    if require_root and os.geteuid() != 0:
        raise ValueError("run as root")
    if check_service and subprocess.run(
        ["systemctl", "is-active", "--quiet", "physics-lab.service"], check=False
    ).returncode == 0:
        raise ValueError("physics-lab.service is running")
    if os.path.lexists(database_file):
        raise ValueError("database already exists; inspect it before initialization")

    metadata = env_file.stat()
    if require_root and (metadata.st_uid != 0 or stat.S_IMODE(metadata.st_mode) != 0o600):
        raise ValueError("private environment file must be root-owned with mode 0600")
    content = env_file.read_text(encoding="utf-8")
    matches = re.findall(r"^PHYSICS_BOOTSTRAP_ADMIN_EMAIL=(.*)$", content, re.MULTILINE)
    if len(matches) != 1 or not EMAIL_RE.fullmatch(matches[0]):
        raise ValueError("first administrator email is missing or invalid")
    for key, old_value in EXPECTED.items():
        if content.count(f"{key}={old_value}\n") != 1:
            raise ValueError(f"{key} is not in the expected initial state")

    # Refuse a visible-input fallback; getpass opens /dev/tty itself.
    require_controlled_tty()
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        password = getpass.getpass("New administrator password (16-200 ASCII letters, digits, _ @ . ! -): ")
        confirmation = getpass.getpass("Repeat administrator password: ")
    if password != confirmation or not PASSWORD_RE.fullmatch(password):
        raise ValueError("passwords differ or contain unsupported characters")

    replacements = {
        "PHYSICS_BOOTSTRAP_SCHOOL_NAME": "格物实验室",
        "PHYSICS_BOOTSTRAP_ADMIN_NAME": "平台管理员",
        "PHYSICS_BOOTSTRAP_ADMIN_PASSWORD": password,
        "PHYSICS_API_TOKEN_SECRET": secrets.token_hex(32),
    }
    for key, value in replacements.items():
        content = replace_one_line(content, key, EXPECTED[key], value)

    fd, temporary = tempfile.mkstemp(prefix=".physics-lab.env.", dir=env_file.parent)
    try:
        os.fchmod(fd, 0o600)
        os.fchown(fd, metadata.st_uid, metadata.st_gid)
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, env_file)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


if __name__ == "__main__":
    try:
        initialize()
    except (OSError, ValueError, getpass.GetPassWarning) as error:
        print(f"PRIVATE_CONFIG_NOT_CHANGED: {error}", file=sys.stderr)
        sys.exit(1)
    print("PRIVATE_CONFIG_READY")
