# Thunderbird Filter Processing

## Accounts

Filters run on three IMAP accounts: **gmail** (`imap.gmail.com`), **bluerug** (`mail.bluerug.org`), and **comcast** (`imap.comcast.net`). Each account has its own filter chain but shares the same overall logic and address books.

## Idempotency

Filters are idempotent. Every rule that takes a permanent action tags the message with a `*_processed` tag (e.g. `financial_processed`, `tutor_processed`) and checks for that tag before firing again. The catch-all uses `tbq_identified` for the same purpose. Re-running the filters on a previously processed message has no effect.

## Filter Execution Order

Filters run top to bottom on each new arriving message. The first matching rule fires and stops execution. The sequence is:

1. Specific category rules (copy to local folder)
2. Whitelist / CardBook / trusted-domain pass-through rules
3. Trash sender rule
4. Spoofed-domain quarantine
5. Catch-all quarantine to Review

## Specific Category Rules (Important Emails)

These rules identify important senders by domain or address book membership. On match they:
- Copy the message to a named Local Folder
- Tag `copied_to_local`
- Tag the category-specific `*_processed` tag
- Tag `tbq_identified`
- Stop execution

The original message remains in the inbox. These messages are **never** sent to Review.

### gmail

| Rule | Condition | Local Folder |
|------|-----------|--------------|
| Tutor (CardBook) | CardBook: Tutor Parents or Tutor Students (`85e10055-5fa3-464f-925e-12c47856b125`) | Local Folders/Tutor |
| Family | Sender email matches any Family contact in Whitelist | Local Folders/Family |
| Financial | `chase.com`, `self.inc`, `paypal.com`, `affirm.com`, `upgrade.com`, `openskycc.com`, `myonlinebill.com`, `upstart.com`, `venmo.com` | Local Folders/Financial |
| Mercury | `mercuryinsurance.com` | Local Folders/Mercury Insurance |
| Kaiser | `kp.org` | Local Folders/Kaiser Permanente |
| Steele Insurance | `siainc.net`, `steeleinsuranceagency.net` | Local Folders/Steele Insurance |
| Overton | `paycomonline` or `Overton` in from | Local Folders/Overton |
| Nan Leng | `Nan Leng` in from | Local Folders/Nan Leng |
| MilesWeb | `@milesweb.com` | Local Folders/Milesweb |

### bluerug

| Rule | Condition | Local Folder |
|------|-----------|--------------|
| Tutor | `web3forms.com` | Local Folders/Tutor |
| Family | Sender email matches any Family contact in Whitelist | Local Folders/Family |
| Financial | `affirm.com`, `venmo.com` | Local Folders/Financial |
| Kaiser | `kp.org` | Local Folders/Kaiser Permanente |
| Sterling | `sterling`, `sterlingcpas` | Local Folders/Sterling |
| Nan Leng | `Nan Leng` in from | Local Folders/Nan Leng |
| Overton | `Overton` in from | Local Folders/Overton |
| MilesWeb | `@milesweb.com` | Local Folders/Milesweb |

### comcast

| Rule | Condition | Local Folder |
|------|-----------|--------------|
| Xfinity Account | `@account.xfinity.com`, `affirm.com` | Local Folders/Financial |
| MilesWeb | `@milesweb.com` | Local Folders/Milesweb |

## Pass-Through Rules (Stay in Inbox, No Review)

These rules identify trusted senders and tag `tbq_identified` to prevent them from reaching the catch-all. No folder copy is made. Applied identically across all three accounts.

| Rule | Condition |
|------|-----------|
| Whitelist | Sender is in the Whitelist address book (`abook-2.sqlite`) |
| CardBook contacts | Sender is in any CardBook address book |
| Trusted domains + auth pass | From domain is `@gmail.com`, `@bluerug.org`, `@comcast.net`, or `@milesweb.com`, AND DMARC or DKIM passes |

## Trash Senders

If the sender is in the Trash Senders address book (`abook-3.sqlite`), the message is tagged `trash` and `tbq_identified` and stops. The message remains in the inbox and is **deleted after 30 days** by a periodic rule. These messages are never copied to Review.

Senders are added to the Trash Senders list via the **mark as trash** review action (see below).

## Spoofed Trusted Domains

If the from address claims to be from a trusted domain (`@gmail.com`, `@bluerug.org`, `@comcast.net`, `@milesweb.com`) but fails all of DMARC, DKIM, SPF, and received-SPF, the message is **moved** (not copied) to Local Folders/Spoofed and tagged `tbq_identified`. The message is removed from the inbox.

## Catch-All Quarantine

Any message that has not yet been tagged `tbq_identified` by a prior rule is copied to Local Folders/Review, tagged `copied_to_local` and `tbq_identified`, and execution stops. The original remains in the inbox.

## Periodic Rules (gmail and bluerug only)

| Rule | Condition | Action |
|------|-----------|--------|
| After 30 days trash | Tagged `trash` and age > 30 days | Delete |
| CardBook non-junk | Sender is in any CardBook address book | Clear junk score |

## Junk Handling

Thunderbird's built-in junk filter may tag arriving messages as junk. No filter rule acts on junk-tagged messages — they remain in the inbox. If a message is manually tagged as junk in the inbox it is immediately deleted by Thunderbird's built-in handling.

## Review Folder Actions

Messages in Local Folders/Review are processed using the **thunderbird-review-actions** extension. Three actions are available:

### Mark as Trash
- Adds the `trash` tag to the original inbox copy (triggering 30-day deletion)
- Adds the sender to the Trash Senders address book so future messages are handled automatically
- Permanently deletes the Review copy

### Mark as Junk
- Marks the inbox copy as junk and permanently deletes it
- Permanently deletes the Review copy

### Approve Sender
- Adds the sender to the Whitelist address book (`abook-2.sqlite`)
- Permanently deletes the Review copy
- Future messages from this sender will pass through without going to Review

## Tags Reference

| Tag | Meaning |
|-----|---------|
| `tbq_identified` | Message has been processed by the filter chain; prevents re-processing |
| `copied_to_local` | Message was copied to a Local Folder |
| `trash` | Message is scheduled for deletion after 30 days |
| `*_processed` | Category-specific idempotency tag (e.g. `financial_processed`, `tutor_processed`) |
| `$label2` | Thunderbird built-in label (used by Overton rules) |
| `$label3` | Thunderbird built-in label (used by Nan Leng / Sterling rules) |

## Address Books

| Book | File | Purpose |
|------|------|---------|
| Whitelist | `abook-2.sqlite` | Trusted senders; pass through to inbox. Family contacts identified by `ORG:Family` in vCard. |
| Trash Senders | `abook-3.sqlite` | Senders whose messages are tagged trash and deleted after 30 days |
| CardBook | IndexedDB (extension storage) | Full contact database; used for Tutor category matching and general pass-through |
