# Thunderbird Tools TODO

## Review findings

- [x] Isolate `thunderbird-restore --self-test` restore-state writes under the temporary self-test root.
- [x] Prevent stale Thunderbird lock files from lingering in the backup mirror.
- [x] Correct `install` dependency warnings for tools that use Python stdlib modules instead of external commands.
- [x] Make `thunderbird-backup` manifest file count match the profile mirror, or label it as backup-root count.
- [x] Update stale Flatpak development override path in review-actions documentation.

## Completed

- [x] Fix `thunderbird-restore --dry-run` / empty-note runs returning failure after reporting success.
- [x] Make `tbblock-rebuild` preserve existing route filters and queue entries when a target local folder is missing.
- [x] Share Thunderbird profile discovery across Flatpak, Snap, and system installs for `tbblock-rebuild`, `thunderbird-dedup-local`, and `tbq-filter-audit`.
- [x] Route Local Folders by stable path/URI instead of display name only, including nested folders and duplicate names.
- [x] Preserve and merge nested Local Folders during restore, not only top-level mbox files.
