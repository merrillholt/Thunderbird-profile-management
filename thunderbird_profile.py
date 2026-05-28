"""Shared Thunderbird profile discovery helpers."""

from __future__ import annotations

import configparser
from pathlib import Path


THUNDERBIRD_DIRS = [
    Path.home() / ".var/app/org.mozilla.thunderbird_esr/.thunderbird",
    Path.home() / ".var/app/org.mozilla.thunderbird/.thunderbird",
    Path.home() / ".var/app/org.mozilla.Thunderbird/.thunderbird",
    Path.home() / "snap/thunderbird/common/.thunderbird",
    Path.home() / ".thunderbird",
]


def find_thunderbird_dir() -> Path:
    for tb_dir in THUNDERBIRD_DIRS:
        if (tb_dir / "profiles.ini").exists():
            return tb_dir
    checked = ", ".join(str(p) for p in THUNDERBIRD_DIRS)
    raise RuntimeError(f"No Thunderbird profiles.ini found. Checked: {checked}")


def find_default_profile(tb_dir: Path | None = None) -> Path:
    tb_dir = tb_dir or find_thunderbird_dir()
    ini = tb_dir / "profiles.ini"
    if ini.exists():
        cp = configparser.ConfigParser()
        cp.read(ini)

        def resolve(rel: str, is_relative: bool) -> Path:
            return tb_dir / rel if is_relative else Path(rel)

        # [Install*] sections reflect the per-install active profile; check these first.
        for section in cp.sections():
            if section.startswith("Install"):
                rel = cp.get(section, "default", fallback="")
                if rel:
                    return resolve(rel, is_relative=True)

        # Fall back to the profile with Default=1.
        for section in cp.sections():
            if cp.get(section, "default", fallback="") == "1":
                rel = cp.get(section, "path", fallback="")
                if rel:
                    is_relative = cp.get(section, "isrelative", fallback="1") == "1"
                    return resolve(rel, is_relative)

    candidates = sorted(tb_dir.glob("*.default*"))
    if candidates:
        return candidates[0]
    raise RuntimeError(f"No Thunderbird profile found in {tb_dir}")


if __name__ == "__main__":
    import sys
    try:
        tb_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else None
        print(find_default_profile(tb_dir))
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
