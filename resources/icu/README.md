# ICU time zone data

`scripts/afterpack.js` uses `scripts/patch_icu_tzdata.js` to replace the time zone resources inside Electron's `icudtl.dat` with the files in this directory. Chromium, and therefore the web app running in the Desktop App, uses that ICU data for `Intl` time zone rules and, on Windows, for mapping the OS time zone to an IANA zone.

This is needed because Electron's ICU (tzdata 2025c as of Electron 44) is missing:

- The 2026 IANA changes for British Columbia (2026b), Alberta and Morocco (2026c), and the Northwest Territories (2026d).
- The Windows `British Columbia Standard Time` and `Alberta Standard Time` zones that Microsoft added in September 2026. They aren't in CLDR yet, so Chromium can't detect them and falls back to UTC.

## Files

| File | Source |
|---|---|
| `metaZones.res`, `timezoneTypes.res`, `zoneinfo64.res` | Unmodified, from [unicode-org/icu-data `tzdata/icunew/2026d/44/le`](https://github.com/unicode-org/icu-data/tree/c5aeb38e05607d094b783f0665bd66219b038ca9/tzdata/icunew/2026d/44/le) |
| `windowsZones.txt` | [`tzdata/icunew/2026d/44/windowsZones.txt`](https://github.com/unicode-org/icu-data/blob/c5aeb38e05607d094b783f0665bd66219b038ca9/tzdata/icunew/2026d/44/windowsZones.txt) plus the two Windows zones marked `Added by Mattermost` |
| `windowsZones.res` | Built from `windowsZones.txt` with `genrb -d . windowsZones.txt` (ICU tools, e.g. `brew install icu4c`) |

To update to a newer tzdata release, repeat the steps above with the new version's directory, keeping the `Added by Mattermost` entries until CLDR has them.

## Removal

Delete this directory, `scripts/patch_icu_tzdata.js`, and its call in `scripts/afterpack.js` once Electron's ICU has both the newer tzdata and the Windows zones. The packaging step logs when that is the case, and fails if Electron's tzdata catches up with this directory while the Windows zones are still missing.
