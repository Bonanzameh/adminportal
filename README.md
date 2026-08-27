# Adminportal

Adminportal generates administrative PDFs and sends them by email.

## Features

- Document generation for:
  - `VAT_PAYMENT`
  - `REIMBURSEMENT`
  - `TAX_PREPAY`
- Template save/edit flow
- Monthly autopilot with per-type template mapping
- Billit drag/drop queue with per-file sends
- Home Assistant EV charging ingestion and reconciliation
- Manual CREG rate history with quarterly reimbursement reports
- Single-screen menu UI
- Settings tab for runtime config (persisted to `data/settings.json`):
  - Gmail account
  - Gmail app password
  - Default recipient
  - Billit recipient
  - Home Assistant bearer token and timezone
  - Charging opening balance
  - Charging report title, indication, recipient, and auto-finalization

## Setup (local)

```bash
npm install
npm start
```

Open <http://localhost:3000>

Configuration can be done directly in the Settings tab. `.env` is optional.

## Docker (zero-touch from git)

```bash
docker compose up -d --build
docker compose down
```

No `.env` file is required. The compose file is preconfigured to download/build from:

- `https://github.com/Bonanzameh/adminportal.git#main`

Configure Gmail account, app password, and recipients in the app Settings tab after first start.

## Home Assistant charging feed

1. Open Settings and generate a Home Assistant bearer token.
2. Save the token and configure the same value in Home Assistant.
3. Configure the opening balance/date if session-level history starts partway through a quarter.
4. Add the applicable CREG rate in EV Charging. Rate end dates are exclusive.

Home Assistant sends JSON with:

```text
Authorization: Bearer <configured token>
Content-Type: application/json
```

Endpoints:

- `POST /api/v1/charging-sessions` for `charging_session`
- `POST /api/v1/daily-summary` for `daily_summary`
- `POST /api/v1/daily-summary` for `session_resync`

Session records are upserted by `session_id`. A reduced resync record does not remove meter readings already received from the full session event. Daily summaries are used as heartbeats and for quarter reconciliation.

Charging session rows can be corrected from the EV Charging ledger. Corrections can be marked as protected manual overrides so later Home Assistant session pushes and resyncs cannot replace them. The ledger shows the applied CREG tariff, source note, calculated amount, and sync/override status for every row.

## Charging reports

- Sessions are attributed to the quarter and CREG rate covering their local start timestamp.
- Gross wall energy is reimbursable; solar and grid values remain informational.
- The opening balance is included only in the quarter containing its configured date. Stored sessions starting on or before that date are excluded from billing to prevent double counting.
- Final totals are calculated before rounding to cents.
- Reports contain detailed sessions, amount due, rate source, and Home Assistant reconciliation.
- Automatic finalization runs at the end of the quarter and catches up after downtime.
- Late session/resync data or changed rates flag an existing final report for review.
- A final report can be emailed once to the charging report recipient or default recipient.

## Docker (alternate file)

`docker-compose.git.yml` is also preconfigured for the same git source.

```bash
docker compose -f docker-compose.git.yml up -d --build
```

## Data persistence

Runtime data files:

- `data/templates.json`
- `data/autopilot.json`
- `data/sent-log.json`
- `data/settings.json`
- `data/charging-sessions.json`
- `data/charging-daily-totals.json`
- `data/charging-rates.json`
- `data/charging-reports.json`

Generated PDFs:

- `generated-pdfs/`

## Security notes

- Never commit `.env`
- Keep secrets in in-app settings (or a server-only `.env` if you choose to use one)
- The Home Assistant token is never returned by the settings API after it is saved
