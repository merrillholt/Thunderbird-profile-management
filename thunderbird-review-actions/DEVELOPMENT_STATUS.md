# Development Status

Last updated: 2026-05-04

## Current state

Version 0.5.1. Source and XPI are in sync. Five actions: Approve sender, Trash sender, Trash domain, Route domain to folder, Mark junk. Native messaging host is implemented and integrated.

## Actions

- **Approve sender** (`approve-sender`)
  - Adds sender to `Whitelist` address book if not already present.
  - If in Review: deletes the Review copy; inbox original is untouched.
  - If not in Review: whitelist add only, no deletion.

- **Trash sender** (`mark-trash`)
  - Adds sender to `Trash Senders` address book.
  - If in Review: finds inbox copies by `headerMessageId`, adds `trash` tag to each, deletes Review copy.
  - If not in Review: adds `trash` tag to the displayed message.
  - 30-day cleanup filter handles eventual deletion.

- **Trash domain** (`mark-trash-domain`)
  - Same as Trash sender (per-sender address book entry + trash tag).
  - Extracts sender domain and sends `{ type: "tbblock-add", domain }` to the `tbblock` native host, which appends `add @domain.com` to `blocked_domains.txt`. Run `tbblock-rebuild` to apply to filter files.
  - If native host fails, popup shows fallback: `Run: tbblock --add @domain.com`.

- **Route domain to folder** (`route-domain`)
  - Popup fetches local folder list via `get-local-folders` (excludes trash, junk, drafts, sent, outbox, templates by `folder.type`).
  - User picks a folder; sends `{ type: "tbblock-route", domain, folder }` using the Thunderbird folder path to native host, which appends `route @domain.com FolderPath` to `blocked_domains.txt`. Run `tbblock-rebuild` to apply.
  - If native host fails, popup shows fallback: `Run: tbblock --route @domain.com "FolderPath"`.

- **Mark junk** (`mark-junk`)
  - If in Review: marks inbox copies as junk, permanently deletes them, deletes Review copy.
  - If not in Review: marks displayed message as junk and permanently deletes it.
  - Note: whether `messages.update({ junk: true })` triggers Bayesian filter training has not been verified.

## Runtime API findings — Thunderbird 128+ / Flatpak

- `manifest_version` must be **2**. MV3 fails to load background scripts.
- `messenger.addressBooks.contacts` does not exist. Use `messenger.contacts`.
- `messenger.contacts.create(parentId, vCard)` fails. Correct call: `messenger.contacts.create(parentId, { PrimaryEmail, DisplayName })`.
- `messenger.contacts.list()` returns objects with properties under `contact.properties`, not at the top level.
- `messenger.folders.query()` requires the `accountsRead` permission.
- `folders.query({ specialUse: ["inbox"] })` requires an array. The extension currently locates inbox folders by name to avoid cross-version special-use issues.
- `MessageHeader.folder` is absent in Thunderbird 140. Folder context is determined by querying the Review folder directly for messages matching `headerMessageId`.

## Permissions

```json
["accountsRead", "addressBooks", "messagesDelete", "messagesRead", "messagesUpdate", "nativeMessaging"]
```

## Flatpak access

For temporary add-on loading during development, grant filesystem access to the source directory:

```bash
flatpak override --user org.mozilla.Thunderbird --filesystem=/mnt/pcloud/bin/thunderbird-tools
```

Do NOT use `--filesystem=home` — it shadows the Flatpak profile path (`~/.var/app/org.mozilla.Thunderbird/.thunderbird`) with `~/.thunderbird`, causing Thunderbird to start with a new empty profile.

The native messaging host manifest and script directory are granted via `install-native-host`.

## Permanent install notes

- The local unsigned XPI can silently fail through **Install Add-on From File...**.
- Permanent Flatpak install is handled by `install-review-actions`, which copies
  the XPI to:
  `~/.var/app/org.mozilla.Thunderbird/.thunderbird/<profile>/extensions/thunderbird-review-actions@merrill.local.xpi`
- The script removes any empty staged directory for the same id and clears
  `addonStartup.json.lz4` before restarting Thunderbird.
- Thunderbird may load the sideloaded extension disabled; enable it in
  **Add-ons and Themes**.

## Remaining work

- Verify whether `messages.update({ junk: true })` triggers Bayesian training.
- Optional: requeue action that removes `tbq_identified` from the inbox copy before deleting the Review copy, allowing the catch-all to re-process it.
- Optional: restrict action buttons to messages displayed from the Review folder only.
- Optional: export/audit command for Whitelist and Trash Senders contents.
