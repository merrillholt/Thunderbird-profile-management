# Thunderbird Review Actions

A Thunderbird MailExtension (v0.5.1) for processing messages in the `Review` local folder.

## Actions

The popup appears on any displayed message and shows five actions. When the message is in the `Review` folder the popup indicates "Review folder — workflow active" and actions operate on the Review copy and its inbox original as a pair. Outside Review, actions operate directly on the displayed message.

- **Approve sender** — adds the sender to the `Whitelist` address book. If in Review, deletes the Review copy; the inbox original is left untouched.
- **Trash sender** — adds the sender to `Trash Senders` and (if in Review) tags the inbox copy `trash` then deletes the Review copy. Outside Review, tags the displayed message `trash`. The existing 30-day cleanup filter removes trash-tagged messages later.
- **Trash domain** — same as Trash sender, and additionally queues the sender's domain in `blocked_domains.txt` via the native messaging host. The popup shows the result and prompts to run `tbblock-rebuild` to apply.
- **Route domain to folder** — opens a folder picker populated from Local Folders, then queues a domain-to-folder route using the Thunderbird folder path in `blocked_domains.txt` via the native messaging host. The target folder must exist in Thunderbird before `tbblock-rebuild` is run. Run `tbblock-rebuild` to apply.
- **Mark junk** — if in Review, marks the inbox copy as junk, permanently deletes it, and deletes the Review copy. Outside Review, marks and immediately deletes the displayed message.

## Assumptions

- Review folder is named `Review` and lives in Local Folders.
- Whitelist address book is named `Whitelist`.
- Trash Senders address book is named `Trash Senders`.
- Existing filters **copy** (not move) messages to Review — originals remain in the inbox.
- Existing cleanup filters delete `trash`-tagged messages after 30 days.
- The native messaging host (`tbblock`) is installed on the review system via `install-native-host`.

## Building the XPI

```bash
./bundle
```

Produces `thunderbird-review-actions.xpi` from the current source files.

## Permanent install on Flatpak Thunderbird

The normal **Install Add-on From File...** flow can silently fail for this local
unsigned XPI. Install it permanently by sideloading the XPI into the active
Flatpak Thunderbird profile, using the extension id as the filename.

Run:

```bash
install-review-actions
```

The script stops Thunderbird if it is running, removes stale staged copies,
clears Thunderbird's add-on startup cache, and copies the XPI to the active
Flatpak profile. Restart Thunderbird, open **Add-ons and Themes**, and enable
**Thunderbird Review Actions** if it loads disabled. Restart Thunderbird once
more if prompted.

To preview or remove the sideloaded extension:

```bash
install-review-actions --dry-run
install-review-actions --uninstall
```

The installed copy lives at:

```
~/.var/app/<Thunderbird Flatpak app id>/.thunderbird/<profile>/extensions/thunderbird-review-actions@merrill.local.xpi
```

The installer supports `org.mozilla.thunderbird_esr`, `org.mozilla.thunderbird`, and `org.mozilla.Thunderbird`.

## Loading for development

1. Open Thunderbird.
2. Go to **Tools → Developer Tools → Debug Add-ons**.
3. Choose **Load Temporary Add-on…** and select `manifest.json`.
4. Open a message and click the **Review Actions** button in the message display toolbar.

Temporary add-ons are removed on Thunderbird restart. Use the installed XPI for normal use.
