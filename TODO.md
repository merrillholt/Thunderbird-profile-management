# Thunderbird Tools TODO

- [x] Fix `thunderbird-restore --dry-run` / empty-note runs returning failure after reporting success.
- [x] Make `tbblock-rebuild` preserve existing route filters and queue entries when a target local folder is missing.
- [x] Share Thunderbird profile discovery across Flatpak, Snap, and system installs for `tbblock-rebuild`, `thunderbird-dedup-local`, and `tbq-filter-audit`.
- [x] Route Local Folders by stable path/URI instead of display name only, including nested folders and duplicate names.
- [x] Preserve and merge nested Local Folders during restore, not only top-level mbox files.
