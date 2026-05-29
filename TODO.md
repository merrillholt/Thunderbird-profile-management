# Thunderbird Tools TODO

## Restic-only profile backup

- [x] Drop the rsync compatibility mirror; profile snapshots are the only profile backup.
- [x] Stage profile-root and metadata into `~/.local/share/thunderbird-backup/aux/` and include them in the restic snapshot.
- [x] Unify logging: drop `backup.log` and `~/thunderbird-restore.log`; extend `activity.log` to five columns (date, host, action, status, detail) with backward-compatible reading of legacy 3-column rows.
- [x] `thunderbird-restore` defaults to the latest profile snapshot; `--snapshot ID` selects a specific one; `--list` lists snapshots; `--check` compares against the latest snapshot time.
- [x] `thunderbird-doctor` shows role, promotes profile-repo missing to FAIL on review machines, adds snapshots-readable and `restic check`.
- [x] `thunderbird-report` reads restic stats for raw repo size + snapshot count, surfaces Status column in the activity table.
- [x] Migration step (manual, after one good run on each machine): `rm -rf "Thunderbird Backup"/{thunderbird,profile-root,metadata,backup.log}` on pCloud.

## Review findings

- [x] Isolate `thunderbird-restore --self-test` restore-state writes under the temporary self-test root.
- [x] Prevent stale Thunderbird lock files from lingering in the backup mirror.
- [x] Correct `install` dependency warnings for tools that use Python stdlib modules instead of external commands.
- [x] Make `thunderbird-backup` manifest file count match the profile mirror, or label it as backup-root count.
- [x] Update stale Flatpak development override path in review-actions documentation.

## Backup Resilience

- [x] Separate ownership of pCloud backup subdirectories so no script deletes another tool's data.
- [x] Replace root-level backup mirroring with targeted syncs and safety markers.
- [x] Make `thunderbird-backup` run Local Folders backup only on non-review machines by default.
- [x] Move full Thunderbird profile backups to versioned snapshots, preferably restic.
  - [x] Add profile restic repository init, snapshot creation, and snapshot listing support.
- [x] Treat pCloud as sync/storage transport, not the backup source of truth.
- [x] Make reports derive Local Folders history from restic snapshots, with activity logs as secondary context.
- [x] Add preflight checks before any destructive sync.
- [x] Add integrity checks for profile and Local Folders backups.
- [x] Add a `doctor` command for backup health, timers, passwords, repos, and restore readiness.
- [x] Add snapshot-based restore listing and restore selection.
  - [x] Add `thunderbird-restore --list` for the current latest profile mirror.
  - [x] Add `thunderbird-restore --snapshot ID` profile restic restore selection.

## Completed

- [x] Fix `thunderbird-restore --dry-run` / empty-note runs returning failure after reporting success.
- [x] Make `tbblock-rebuild` preserve existing route filters and queue entries when a target local folder is missing.
- [x] Share Thunderbird profile discovery across Flatpak, Snap, and system installs for `tbblock-rebuild`, `thunderbird-dedup-local`, and `tbq-filter-audit`.
- [x] Route Local Folders by stable path/URI instead of display name only, including nested folders and duplicate names.
- [x] Preserve and merge nested Local Folders during restore, not only top-level mbox files.
