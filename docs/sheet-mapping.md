# Google Sheet → Contact mapping

Based on the client's real sheet format (`INDUSTRY | COMPANY | PERSON NAME | PROFILE | CONTACT | MAIL | LOCATION | STATUS | SOURCE` — the testing sheet used the same layout minus the `INDUSTRY` column; columns are matched by header name, not position, so this addition needed no reordering). The mapping code lives in `apps/api/src/services/importValidation.ts` (`HEADER_ALIASES`).

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
| INDUSTRY | `industry` | Added to the real sheet (not present in the original testing sheet); now mapped directly to `Contact.industry`. |
| — | `domain` | Still not present in the sheet. Left nullable. |

Sync behavior (per spec §1, §13.9): manual button click, blank cells never overwrite existing non-blank fields, campaign/send history untouched by re-sync, every sync returns New/Updated/Skipped/Invalid/Needs Review counts.
