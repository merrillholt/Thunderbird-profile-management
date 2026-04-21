# Thunderbird Review Actions

This is a Thunderbird MailExtension for working messages out of the `Review`
folder.

## Current behavior

- `Approve sender`: adds the displayed sender to the Thunderbird address book
  named `Whitelist`. If the current message is in `Review`, it deletes the
  Review copy and leaves the Inbox copy unchanged.
- `Mark trash`: adds the sender to `Trash Senders`, tags the Inbox copy with
  `trash`, and deletes the Review copy. The existing 30-day cleanup filters
  remove tagged Inbox messages later.
- `Mark junk`: marks the Inbox copy as junk, deletes it, and deletes the Review
  copy.

## Assumptions

- The review folder is named `Review`.
- The approval address book is named `Whitelist`.
- The trash-after-30-days address book is named `Trash Senders`.
- Thunderbird is new enough for MailExtension manifest v2 support.

These values are defined near the top of [background.js](./background.js).

## Installed package

The packaged extension is `thunderbird-review-actions.xpi`. The installed
profile copy is:

```text
~/.var/app/org.mozilla.Thunderbird/.thunderbird/bqmdw26k.default-default/extensions/thunderbird-review-actions@merrill.local.xpi
```

## Loading for testing

1. Open Thunderbird.
2. Go to `Tools` -> `Developer Tools` -> `Debug Add-ons`.
3. Choose `Load Temporary Add-on...`.
4. Select [manifest.json](./manifest.json).
5. Open a message and click the `Review Actions` button in the message display toolbar.

## Next improvements

- Restrict the action button to messages shown from `Review`.
- Add a requeue action that removes `tbq_identified` from the Inbox copy before
  deleting the Review copy.
- Add an export/audit command for Whitelist and Trash Senders.
