# Thunderbird Tools

## How the system works

One machine is the **review system**. Its Thunderbird catches all unrecognised mail in `Local Folders/Review` and its filter catch-all is enabled. Every other machine has the catch-all disabled so mail is not intercepted before the review system sees it.

Filter rules and address books live in the Thunderbird profile. The review system publishes the shared profile to pCloud (`Thunderbird Backup/profile-restic/`) as a restic snapshot repository — each backup is a new snapshot, and any snapshot can be restored on any machine. Non-review machines use the same `thunderbird-backup` command, but it skips publishing the shared profile and runs the Local Folders backup only. Domain block/route changes are queued in `blocked_domains.txt` (pCloud-synced) so any machine can queue a change, but `tbblock-rebuild` applies queued changes to local filter files and must be run per-machine.

---

## Blocking and routing domains

### Mark a sender domain for deletion

`tbblock --add` tags incoming mail from a domain as `trash` and `tbq_identified`. The message stays in the inbox and is auto-deleted after 30 days by the periodic trash rule. It does not bounce, reject, or immediately remove mail.

```bash
tbblock --add @domain.com          # queue the domain
# then apply — see "Applying changes" below
```

### Remove a domain from the trash list

```bash
tbblock --delete @domain.com
# then apply
```

### Route a domain to a specific local folder

The target folder must exist in Thunderbird before applying.

1. Create the folder in Thunderbird (right-click Local Folders → New Folder).
2. Queue the route. Top-level folders can use their folder name; nested folders
   should use the Thunderbird folder path:
   ```bash
   tbblock --route @domain.com FolderName
   tbblock --route @domain.com Parent/Child
   ```
3. Apply (see below).
4. Back up and restore on all other machines (see below) — the new folder propagates with the backup.

If `tbblock-rebuild` shows the route as deferred because the local folder was
not found, the route stays queued. Create the folder in Thunderbird and re-run.

### Remove a domain route

```bash
tbblock --unroute @domain.com
# then apply
```

### Check pending changes

```bash
tbblock --list                     # show queued changes
tbblock-rebuild --list             # show current filter state and role
```

---

## Applying changes

Changes queued with `tbblock` must be applied to each machine's local filter files. The standard workflow is to apply on the review system, then propagate via backup/restore.

### On the review system

```bash
# Close Thunderbird first, then:
tbblock-rebuild                    # preview, confirm, apply; clears the queue
```

After applying, back up and restore on all other machines (see next section).

### If you only need to apply domain blocks (no address book changes)

You can run `tbblock-rebuild` directly on each machine instead of doing a full backup/restore cycle, since `blocked_domains.txt` is pCloud-synced. Non-review machines will re-disable the catch-all automatically.

---

## Propagating changes to all other machines

Run this after applying changes on the review system, after address book changes from review actions (whitelist, trash senders), or after creating new local folders.

**On the review system:**

```bash
thunderbird-backup
thunderbird-localfolders-backup
```

**On each other machine:**

```bash
thunderbird-backup                 # local folders backup only on non-review machines
thunderbird-restore --check        # confirm restore is needed first
# Close Thunderbird first, then:
thunderbird-restore
# tbblock-rebuild runs automatically at the end of thunderbird-restore
```

`thunderbird-restore` restores the shared profile onto each machine. The default restores the latest profile snapshot from the restic repository; `thunderbird-restore --snapshot <id>` restores a specific snapshot instead. A merge step preserves messages that exist locally but are absent from the backup, so no local messages are lost.

The merge step can occasionally introduce duplicate messages in local folders. If duplicates appear after a restore, run:

```bash
thunderbird-dedup-local              # preview duplicates
thunderbird-dedup-local --apply      # remove them (Thunderbird must be closed)
```

Note: `blocked_domains.txt` lives in the pCloud script directory, not the profile, so any pending queued entries survive restores unchanged. If something was queued before the restore it remains queued and will be applied on the next `tbblock-rebuild`.

### When is backup/restore necessary?

| Change | Backup/restore needed? |
|--------|------------------------|
| Domain add/remove (trash tagging) | Optional — can run `tbblock-rebuild` on each machine directly |
| Domain route (new or changed) | Yes — propagates the new folder and filter URI |
| Whitelist addition (from Approve action) | Yes |
| Trash Senders addition (from Mark as Trash) | Yes |
| New local folder created | Yes |

---

## Checking if a restore is needed

After each successful restore, `thunderbird-restore` records the backup date in `~/.config/tbblock/last-restore`. To check whether the current backup is newer than the last restore on this machine:

```bash
thunderbird-restore --check
```

Output:
```
Backup date:   2026-05-04 14:30:00
Last restore:  2026-05-03 09:15:00
NOTE: verify pCloud has finished syncing on this machine before restoring.
Status:        Restore needed (backup is newer than last restore)
```

Exit codes: `0` = up to date, `1` = restore needed, `2` = cannot determine. Usable in scripts:

```bash
thunderbird-restore --check || thunderbird-restore
```

The check only requires pCloud to be mounted — it does not inspect the local Thunderbird profile.

To inspect available restore targets:

```bash
thunderbird-restore --list
thunderbird-restore --snapshot <snapshot-id>
```

---

## Re-running install after updates

The repo syncs to all machines automatically via pCloud, but `~/bin` symlinks and systemd timers do not update themselves. Re-run `install` on each machine when:

- New scripts are added to the toolset (new symlinks needed)
- Systemd unit files are changed (timers need reloading)
- pCloud drops execute bits from one or more scripts

```bash
chmod +x install && ./install
```

The `chmod +x` is required because the pCloud filesystem does not preserve execute bits across syncs. Running `install` then restores execute bits on all scripts. The script is idempotent — it skips symlinks that are already correct and only updates what has changed.

---

## Setting up a new machine

1. Install Thunderbird and launch it once to create a profile.
2. Close Thunderbird.
3. Run the install script to create `~/bin` symlinks and enable backup timers:
   ```bash
   chmod +x install && ./install
   ```
   The `chmod +x` is needed because the pCloud filesystem does not preserve
   execute bits across syncs.
4. Mark the machine as non-review if this will not be the review system:
   ```bash
   mkdir -p ~/.config/tbblock && touch ~/.config/tbblock/no-review
   ```
5. Restore the current profile:
   ```bash
   thunderbird-restore
   ```
   Use `thunderbird-restore --list` and `thunderbird-restore --snapshot <id>` if you want a specific profile snapshot instead of the latest.
6. On non-review machines, `thunderbird-backup` only runs the Local Folders backup. On the review system, `thunderbird-backup` creates a new profile restic snapshot. Run `thunderbird-localfolders-backup` on the review system if you want the review machine's Local Folders snapshot too.

   **Prerequisite:** the restic password file `~/pcloud/Thunderbird Backup/.restic-password` (or `RESTIC_PASSWORD` / `RESTIC_PASSWORD_FILE`) must be readable before the first restore. Without it, this machine cannot extract any profile snapshot.
7. `thunderbird-restore` runs `tbblock-rebuild` and (for Flatpak) `install-native-host`
   automatically — no manual run needed.
8. On the review system, install the review actions extension permanently:
   ```bash
   install-review-actions
   ```
   Restart Thunderbird, open **Add-ons and Themes**, and enable
   **Thunderbird Review Actions** if it loads disabled.

---

## Changing the review system

### On the old review system

```bash
tbblock-rebuild                    # disable catch-all before demotion
thunderbird-backup                 # capture the final shared profile state
mkdir -p ~/.config/tbblock && touch ~/.config/tbblock/no-review
```

### On the new review system

```bash
rm -f ~/.config/tbblock/no-review
thunderbird-restore                # restore current profile
# tbblock-rebuild runs automatically and enables the catch-all
thunderbird-backup                 # publish the shared profile from the new review system
thunderbird-localfolders-backup    # capture the review machine's Local Folders snapshot
```

### On all other machines

```bash
thunderbird-restore
# tbblock-rebuild runs automatically and re-disables the catch-all
thunderbird-backup                 # local folders backup only
```

---

## Review folder actions

The **thunderbird-review-actions** extension is designed for use on the review system. Actions that modify address books (Whitelist, Trash Senders) write to local profile files and will be overwritten by the next `thunderbird-restore` on any other machine — so those actions are only meaningful on the review system.

For permanent install/update instructions, see
`thunderbird-review-actions/README.md`. After sideloading the XPI, Thunderbird
may show the extension as disabled on first startup; enable it in **Add-ons and
Themes**.

On the **review system**, with a message open in `Local Folders/Review`:

- **Approve sender** — adds sender to the Whitelist; deletes the Review copy. Back up afterwards to propagate the whitelist change.
- **Trash sender** — adds sender to Trash Senders; tags the inbox copy `trash` (auto-deleted after 30 days); deletes the Review copy. Back up afterwards.
- **Trash domain** — same as above, and queues the whole domain in `blocked_domains.txt` for `tbblock-rebuild`. The queue entry survives restores.
- **Mark junk** — marks the inbox copy as junk and permanently deletes both copies.
- **Route domain to folder** — queues a domain-to-folder route in `blocked_domains.txt` for `tbblock-rebuild`.

On a **non-review machine** the extension has no Review folder to process. The only actions that are durable across restores are **Mark junk** (acts on IMAP server state) and the two domain-queue actions (**Trash domain**, **Route domain to folder**), since they write to the pCloud-synced `blocked_domains.txt` rather than the profile.

---

## Restic repositories

The review system maintains profile snapshots with `thunderbird-backup` in `Thunderbird Backup/profile-restic/`. Every machine maintains Local Folders snapshots with `thunderbird-localfolders-backup` in `Thunderbird Backup/localfolders-restic/`. Both repos use the shared password file `Thunderbird Backup/.restic-password`.

**First-time setup (once, on one machine):**

```bash
chmod 600 ~/pcloud/"Thunderbird Backup"/.restic-password
thunderbird-backup init-profile-repo
thunderbird-localfolders-backup init
```

**List profile snapshots:**

```bash
thunderbird-backup profile-snapshots
# or:
thunderbird-restore --list
```

**List Local Folders snapshots:**

```bash
thunderbird-localfolders-backup snapshots
```

**Restore a specific file from a Local Folders snapshot:**

```bash
restic -r ~/pcloud/"Thunderbird Backup"/localfolders-restic snapshots
restic -r ~/pcloud/"Thunderbird Backup"/localfolders-restic restore <snapshot-id> \
  --include "Inbox" --target /tmp/tb-restore
```

**Restore a specific profile snapshot:**

```bash
thunderbird-restore --snapshot <snapshot-id>
```

The `install` script enables timers on every machine (daily Local Folders backup at 9am, monthly prune on the 1st), so each machine independently contributes its Local Folders state to the shared pCloud restic repository. Snapshots are tagged by hostname. Profile snapshots are created on-demand by running `thunderbird-backup` on the review system.

---

## Audit and diagnostics

```bash
thunderbird-report                 # full status: backup, restore, role, and computer activity
thunderbird-doctor                 # backup health, repos, timers, password, install links
thunderbird-restore --check        # quick check: is this machine's restore up to date?
thunderbird-restore --list         # list available profile snapshots in the restic repo
thunderbird-backup profile-snapshots
thunderbird-localfolders-backup snapshots
thunderbird-audit                  # inspect profiles, detect orphans
thunderbird-audit --fix            # interactive cleanup (use with care)
tbblock-rebuild --list             # show role, catch-all state, blocked domains, routes
tbq-filter-audit --account bluerug --search paypal --why
tbq-filter-audit --search reverb --limit 5
```

Every backup and restore — including cancellations and errors — appends a five-column row to `Thunderbird Backup/activity.log` on pCloud (date, host, action, status, detail). `thunderbird-report` is the single central view: it reads the activity log plus the restic snapshot history to render a **Computer Activity** table showing each machine's most recent backup, LF backup, restore, and status.

---

## Backup bundle layout

The backup is stored under `Thunderbird Backup/` on pCloud:

| Path | Contents |
|------|----------|
| `profile-restic/` | Restic repository: profile body + `profiles.ini`/`installs.ini` + Flatpak/MIME/native-messaging metadata, snapshotted by the review system |
| `localfolders-restic/` | Restic repository: per-machine `Mail/Local Folders` snapshots, tagged by hostname |
| `.restic-password` | Shared restic password file (chmod 600) |
| `activity.log` | Five-column TSV: date, host, action, status, detail. Cross-machine log of every backup, LF backup, and restore — including cancellations and errors. |

On the review system, `thunderbird-backup` creates one restic snapshot containing both the active profile and an auxiliary tree (profile-root + metadata) staged under `~/.local/share/thunderbird-backup/aux/`. Non-review machines skip the profile snapshot and run the Local Folders backup only. `thunderbird-restore` extracts the latest profile snapshot by default; `--snapshot <id>` selects a specific one.
