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
- `thunderbird-localfolders-backup`: Historical snapshot backup of Local Folders
  using restic. Scheduled automatically by `install` via systemd timers.
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
./thunderbird-localfolders-backup init
./thunderbird-localfolders-backup
./thunderbird-localfolders-backup snapshots
./thunderbird-localfolders-backup prune
```

## Local Folders historical backup (restic)

`thunderbird-localfolders-backup` keeps dated snapshots of `Mail/Local Folders`
so you can recover individual messages deleted weeks ago, even after a
`thunderbird-backup`/restore cycle has overwritten the mirror.

**First-time setup (once, on one machine):**

```bash
# Generate a password and store it (pCloud syncs it to all machines)
openssl rand -base64 32 > ~/pcloud/"Thunderbird Backup"/.restic-password
chmod 600 ~/pcloud/"Thunderbird Backup"/.restic-password

# Initialize the shared repository on pCloud
thunderbird-localfolders-backup init
```

**On every machine** — run `install` to create `~/bin` symlinks and enable the
systemd timers (daily backup at 9am, monthly prune on the 1st). If the machine
is asleep at the scheduled time the job runs automatically on next wake.

```bash
./install
```

Check timer status and logs:

```bash
systemctl --user list-timers tb-localfolders-backup.timer tb-localfolders-prune.timer
journalctl --user -u tb-localfolders-backup
```

**Restore a specific file from a snapshot:**

```bash
restic -r ~/pcloud/"Thunderbird Backup"/localfolders-restic snapshots
restic -r ~/pcloud/"Thunderbird Backup"/localfolders-restic restore <snapshot-id> \
  --include "Inbox" --target /tmp/tb-restore
```

## Multi-system setup (review vs non-review)

One machine is the designated review system; others should have the catch-all
quarantine filter disabled so they do not steal incoming mail before the review
system processes it.

On each **non-review** machine, create the marker file once:

```bash
mkdir -p ~/.config/tbblock && touch ~/.config/tbblock/no-review
```

After that, running `tbblock-rebuild` on that machine automatically disables the
catch-all in the filter files. After restoring a backup from the review system
onto a non-review machine, just run `tbblock-rebuild` (with Thunderbird closed)
and the catch-all will be disabled again automatically.

`tbblock-rebuild --list` shows the current role and catch-all state for all
accounts. `tbblock-rebuild --no-review` forces non-review behaviour for a single
run without creating the marker file.

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
