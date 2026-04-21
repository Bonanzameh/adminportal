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
- Single-screen menu UI
- Settings tab for runtime config (persisted to `data/settings.json`):
  - Gmail account
  - Gmail app password
  - Default recipient
  - Billit recipient

## Setup (local)

```bash
npm install
npm start
```

Open <http://localhost:3000>

Configuration can be done directly in the Settings tab. `.env` is optional.

## Docker (local repo)

```bash
docker compose up -d --build
docker compose down
```

No `.env` file is required. Configure Gmail account, app password, and recipients in the app Settings tab after first start.

## Docker (build from git)

Use `docker-compose.git.yml` and set the correct git URL/branch in the file.

```bash
docker compose -f docker-compose.git.yml up -d --build
```

## Data persistence

Runtime data files:

- `data/templates.json`
- `data/autopilot.json`
- `data/sent-log.json`
- `data/settings.json`

Generated PDFs:

- `generated-pdfs/`

## Security notes

- Never commit `.env`
- Keep secrets in in-app settings (or a server-only `.env` if you choose to use one)
