# Development Status

Last updated: 2026-04-24

## Current state

The extension is at version 0.4.0. Source and XPI are in sync. The XPI must
be re-installed in Thunderbird to pick up the 0.4.0 changes (two trash buttons).

## Actions

- **Approve sender**
  - Extracts the sender email from the displayed message.
  - Adds the sender to the Whitelist address book if not already present.
  - If the message is a Review folder copy, permanently deletes it (the
    original remains in the Inbox).

- **Trash sender**
  - Adds the sender to the `Trash Senders` address book if not already present.
  - If in Review: finds Inbox copies by Message-ID, adds the `trash` tag to
    those Inbox copies, and permanently deletes the Review copy.
  - If not in Review: adds the `trash` tag to the current message.
  - Thunderbird filters handle cleanup of trash-tagged messages after 30 days.

- **Trash domain**
  - Same as Trash sender (per-sender address book entry + trash tag).
  - Additionally extracts the sender's domain (`@domain.com`) and displays
    it in the status line as `Run: tbblock @domain.com`.
  - After quitting Thunderbird, run `tbblock @domain.com` to add the domain to
    `~/bin/blocked_domains.txt` and rebuild the `[TBQ] Blocked domains` filter
    in all account filter files. Restart Thunderbird to activate the filter.
  - The per-sender entry in Trash Senders provides immediate protection for
    that sender; the domain filter catches all future senders at that domain.

- **Mark junk**
  - If in Review: finds Inbox copies by Message-ID, marks them as junk,
    permanently deletes them, and permanently deletes the Review copy.
  - If not in Review: marks the current message as junk and permanently deletes
    it.
  - Note: whether `messages.update({ junk: true })` triggers Bayesian filter
    training (vs just setting the flag) has not been verified.

## Runtime API findings — Thunderbird 140 / Flatpak

- `manifest_version` must be **2**. MV3 fails to load background scripts.
- `messenger.addressBooks.contacts` does not exist. Use `messenger.contacts`.
- `messenger.contacts.create(parentId, vCard)` fails. The correct call is
  `messenger.contacts.create(parentId, { PrimaryEmail, DisplayName })`.
- `messenger.contacts.list()` returns objects with properties under
  `contact.properties`, not at the top level. Email is at
  `contact.properties.PrimaryEmail`.
- `messenger.folders.query()` requires the `accountsRead` permission.
- `folders.query({ specialUse: ["inbox"] })` requires an array, not a string.
  The installed extension currently locates Inbox folders by name to avoid
  cross-version special-use query issues.
- `MessageHeader.folder` is not present in Thunderbird 140. Folder context
  must be determined by querying the folder directly.
- The Review folder copy is identified by querying the Review folder for
  messages matching `headerMessageId`, then comparing `message.id`.

## Permissions

```json
["accountsRead", "addressBooks", "messagesDelete", "messagesRead", "messagesUpdate"]
```

## Flatpak access

Thunderbird (Flatpak) requires an explicit filesystem grant to load a
temporary extension from the home directory:

```
flatpak override --user org.mozilla.Thunderbird --filesystem=/home/merrill/thunderbird-review-actions
```

Do NOT use `--filesystem=home` — it shadows the Flatpak profile path
(`~/.var/app/org.mozilla.Thunderbird/.thunderbird`) with the real `~/.thunderbird`,
causing Thunderbird to start with a new empty profile.

## Assumptions

- Thunderbird profile has an address book named `Whitelist`.
- Thunderbird profile has an address book named `Trash Senders`.
- Review folder is named `Review` and lives in Local Folders.
- Existing filters **copy** (not move) messages to Review — originals remain
  in Inbox.
- Existing cleanup filters delete `trash`-tagged messages after 30 days.

## Backup status

- `thunderbird-backup` now creates a restore bundle containing active profile
  contents, `profiles.ini`, `installs.ini`, Flatpak metadata, portal permission
  metadata, and MIME/default-handler metadata.
- A verified backup was written to `/mnt/pcloud/Thunderbird Backup` on
  2026-04-20 at 12:00:15.

## Domain blocking CLI (`tbblock`, `tbblock-rebuild`)

Two scripts in `thunderbird-tools/` manage the `[TBQ] Blocked domains -> Trash`
filter. The filter is inserted after `[TBQ] Trash senders -> Trash` and before
`[TBQ] Spoofed trusted domains -> Spoofed`, so the whitelist still wins for
false-positive recovery.

```
tbblock @domain.com          # add a domain and rebuild filters
tbblock --remove @domain.com # remove a domain and rebuild filters
tbblock --list               # list all blocked domains
tbblock-rebuild --dry-run    # preview changes without writing
```

Canonical source: `~/bin/blocked_domains.txt` (one `@domain.com` per line).
Thunderbird must be closed when `tbblock-rebuild` runs; it checks and errors
if TB is running.

## Remaining work

- Verify whether `messages.update({ junk: true })` triggers Bayesian training.
- Optional: add an explicit "requeue/clear review" action that removes
  `tbq_identified` from the Inbox copy before deleting the Review copy.
- Optional: add an export/audit command for `Whitelist` and `Trash Senders`.
- Optional: add native messaging host so "Trash domain" can write to
  `blocked_domains.txt` directly from the extension (requires Flatpak sandbox
  filesystem grant and a native host manifest).
