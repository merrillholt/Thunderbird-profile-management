# Thunderbird Profile Management

Utilities for auditing, backing up, and restoring Thunderbird profiles across
System, Flatpak, and Snap installations.

## Scripts
- `thunderbird-audit`: Audit profiles and detect orphans/broken entries. Optional `--fix` for interactive cleanup.
- `thunderbird-backup`: Create a backup of Thunderbird profiles.
- `thunderbird-restore`: Restore profiles from a backup.

## Usage

```bash
./thunderbird-audit
./thunderbird-audit --fix
./thunderbird-backup
./thunderbird-restore
```

## Notes
- The audit script is verbose by design and reports sizes, mtimes, and validation checks.
- Use `--fix` carefully; it can delete unused or orphaned profiles after confirmation.
