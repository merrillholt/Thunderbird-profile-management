# Thunderbird Profile Management

Utilities for auditing, backing up, and restoring Thunderbird profiles across
System, Flatpak, and Snap installations.

## Scripts
- `thunderbird-audit`: Audit profiles and detect orphans/broken entries. Optional `--fix` for interactive cleanup.
- `thunderbird-backup`: Create a Thunderbird restore bundle. It mirrors the
  active profile, saves `profiles.ini`/`installs.ini`, and records Flatpak and
  MIME/default-handler metadata when available.
- `thunderbird-restore`: Restore profile contents from a backup. On a new
  Kubuntu system, install Thunderbird first, launch it once to create a target
  profile, then run this script.
- `tbq-filter-audit`: Read-only filter-rule simulator for messages in a
  Thunderbird mbox folder. It can explain which rule would catch messages in
  folders such as `Local Folders/Review`.

## Usage

```bash
./thunderbird-audit
./thunderbird-audit --fix
./thunderbird-backup
./thunderbird-backup --dry-run
./thunderbird-backup --self-test
./thunderbird-restore
./thunderbird-restore --dry-run
./thunderbird-restore --self-test
./tbq-filter-audit --search reverb --limit 5
./tbq-filter-audit --account bluerug --search affirm --show-notes
./tbq-filter-audit --account bluerug --search paypal --why
./tbq-filter-audit --preserve-tags --limit 10
```

## Notes
- The audit script is verbose by design and reports sizes, mtimes, and validation checks.
- Use `--fix` carefully; it can delete unused or orphaned profiles after confirmation.
- The backup/restore scripts accept a pCloud FUSE sync at `/mnt/pcloud` and only require the directory to be readable/writable.
- `--self-test` runs non-interactive tests using temporary data and does not touch real profiles or pCloud data.
- `tbq-filter-audit` is read-only. By default it ignores generated processing
  tags such as `tbq_identified` so messages already copied to Review can be
  evaluated like newly arrived mail.
- Use `--why` to show which earlier rules failed before the matching rule.
- Address books are opened read-only with SQLite immutable mode so the audit can
  run while Thunderbird has the profile open.
- CardBook `searchFrom is in ab` rules are evaluated from CardBook's read-only
  IndexedDB storage, including category rules such as Tutor Parents/Students.
- The restore bundle is stored under `Thunderbird Backup/`:
  - `thunderbird/` contains the active profile contents.
  - `profile-root/` contains profile registry files.
  - `metadata/` contains Flatpak, portal, and desktop-handler metadata for
    reconstructing the install on another Kubuntu system.
