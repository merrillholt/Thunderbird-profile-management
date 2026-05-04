# Thunderbird Tools

## How the system works

One machine is the **review system**. Its Thunderbird catches all unrecognised mail in `Local Folders/Review` and its filter catch-all is enabled. Every other machine has the catch-all disabled so mail is not intercepted before the review system sees it.

Filter rules and address books live in the Thunderbird profile. The profile is backed up to pCloud (`Thunderbird Backup/`) and restored onto each machine. Domain block/route changes are queued in `blocked_domains.txt` (pCloud-synced) so any machine can queue a change, but `tbblock-rebuild` applies queued changes to local filter files and must be run per-machine.

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
```

**On each other machine:**

```bash
thunderbird-restore --check        # confirm restore is needed first
# Close Thunderbird first, then:
thunderbird-restore
tbblock-rebuild                    # re-disables catch-all on non-review machines
```

`thunderbird-restore` uses rsync with `--delete`, so the restored profile exactly matches the backup. Any new local folders created on the review system will appear on restored machines. A merge step preserves messages that exist locally but are absent from the backup, so no local messages are lost.

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
Status:        Restore needed (backup is newer than last restore)
```

Exit codes: `0` = up to date, `1` = restore needed, `2` = cannot determine. Usable in scripts:

```bash
thunderbird-restore --check || thunderbird-restore
```

The check only requires pCloud to be mounted — it does not inspect the local Thunderbird profile.

---

## Re-running install after updates

The repo syncs to all machines automatically via pCloud, but `~/bin` symlinks and systemd timers do not update themselves. Re-run `install` on each machine when:

- New scripts are added to the toolset (new symlinks needed)
- Systemd unit files are changed (timers need reloading)

```bash
./install
```

The script is idempotent — it skips symlinks that are already correct and only updates what has changed.

---

## Setting up a new machine

1. Install Thunderbird and launch it once to create a profile.
2. Close Thunderbird.
3. Run `thunderbird-restore` to load the current profile.
4. Run the install script to create `~/bin` symlinks and enable backup timers:
   ```bash
   ./install
   ```
5. Mark the machine as non-review (skip if this will be the review system):
   ```bash
   mkdir -p ~/.config/tbblock && touch ~/.config/tbblock/no-review
   ```
6. Apply filters for this machine's role:
   ```bash
   tbblock-rebuild
   ```
7. On the review system, install the native messaging host for the review actions extension:
   ```bash
   install-native-host
   ```
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
mkdir -p ~/.config/tbblock && touch ~/.config/tbblock/no-review
# Close Thunderbird, then:
tbblock-rebuild                    # disables catch-all
thunderbird-backup                 # capture current state
```

### On the new review system

```bash
rm -f ~/.config/tbblock/no-review
thunderbird-restore                # restore current profile
tbblock-rebuild                    # enables catch-all
```

### On all other machines

```bash
thunderbird-restore
tbblock-rebuild                    # re-disables catch-all (no-review marker already set)
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

## Historical snapshot backup (restic)

`thunderbird-localfolders-backup` keeps dated snapshots of `Mail/Local Folders` so individual deleted messages can be recovered even after a profile restore cycle has overwritten them. The `install` script enables timers on every machine (daily backup at 9am, monthly prune on the 1st), so each machine independently contributes its Local Folders state to the shared pCloud restic repository. Snapshots are tagged by hostname.

**First-time setup (once, on one machine):**

```bash
openssl rand -base64 32 > ~/pcloud/"Thunderbird Backup"/.restic-password
chmod 600 ~/pcloud/"Thunderbird Backup"/.restic-password
thunderbird-localfolders-backup init
```

**Check timer status:**

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

---

## Audit and diagnostics

```bash
thunderbird-restore --check        # check if backup is newer than last restore
thunderbird-audit                  # inspect profiles, detect orphans
thunderbird-audit --fix            # interactive cleanup (use with care)
tbblock-rebuild --list             # show role, catch-all state, blocked domains, routes
tbq-filter-audit --account bluerug --search paypal --why
tbq-filter-audit --search reverb --limit 5
```

---

## Backup bundle layout

The backup is stored under `Thunderbird Backup/` on pCloud:

| Path | Contents |
|------|----------|
| `thunderbird/` | Active profile contents (filters, address books, local folders) |
| `profile-root/` | `profiles.ini` and `installs.ini` |
| `metadata/` | Flatpak overrides, portal grants, MIME handler defaults |
| `localfolders-restic/` | Restic repository for historical Local Folders snapshots |
