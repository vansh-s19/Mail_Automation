# Google Sheet → Contact mapping

Based on the client's actual sheet format (`COMPANY | PERSON NAME | PROFILE | CONTACT | MAIL | LOCATION | STATUS | SOURCE`).

| Sheet column | Contact field | Notes |
|---|---|---|
| MAIL | `email` | Required. Dedup key (case-insensitive). Row skipped if missing/invalid. |
| PERSON NAME | `name` | Missing → row flagged `needs_review`, still imported. |
| PROFILE | `title` | Job title, used for merge tag `{{title}}`. |
| COMPANY | `company` | |
| CONTACT | `phone` | Excel stores long numbers in scientific notation (e.g. `7.760968855E9`) — normalize to plain digits on import. |
| LOCATION | `location_raw` | Free text (e.g. "New Delhi, Delhi, India"), resolved to `resolved_timezone` (IANA) at import time. |
| STATUS | `custom_fields.status` | Lead-gen note (e.g. "Email Verified"), not campaign/send status — kept as metadata only. |
| SOURCE | `custom_fields.source` | Scraping tool/source (e.g. "Apollo", "SalesNav + Hunter"). |
| — | `domain`, `industry` | Not present in the sheet today. Left nullable; can be backfilled manually or added to the sheet later without a schema change. |

Sync behavior (per spec §1, §13.9): manual button click, blank cells never overwrite existing non-blank fields, campaign/send history untouched by re-sync, every sync returns New/Updated/Skipped/Invalid/Needs Review counts.
