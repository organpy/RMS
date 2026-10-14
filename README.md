# RMS

Membership and subscription management for schools, gyms, studios and clubs: anyone that runs **courses**, splits them into **groups**, and charges **members** on a recurring **plan**.

It runs entirely on your own machine. There is no cloud account and no external service. Data lives in a single SQLite file.

- **Members**: search, filters and CSV export. Status (active / due / overdue) is worked out from what each member has actually paid.
- **Payments**: each payment advances the member's coverage. Every payment gets a numbered PDF invoice, and payments can be refunded.
- **Reminders**: lists members who are due or overdue, with prefilled email, SMS and WhatsApp messages. The app logs who was contacted.
- **Dashboard and analytics**: revenue, active members, and breakdowns by plan and by course.
- **Staff accounts**: admin and staff roles, scrypt-hashed passwords and httpOnly session cookies.
- **Backups**: one-click or scheduled snapshots, plus a validated restore.

## Run it

Requires Python 3.11+ and Node 20+.

```bash
scripts/start.sh
```

Open http://127.0.0.1:8000. On first launch you create the organization and the admin account.

To use it from other devices on your network (tablets at the front desk, for example), bind to all interfaces:

```bash
RMS_HOST=0.0.0.0 scripts/start.sh
```

Then open `http://<this-computer's-ip>:8000`. Only expose it on networks you trust. If you put it behind a reverse proxy with HTTPS, set `RMS_SECURE_COOKIES=true`.

## Configuration

Settings come from environment variables or a `.env` file (see `.env.example`).

| Variable | Default | |
|---|---|---|
| `RMS_HOST` / `RMS_PORT` | `127.0.0.1` / `8000` | Where the server listens |
| `RMS_DATA_DIR` | `./data` | Database, backups, logo and generated secret key |
| `RMS_DATABASE_URL` | `sqlite:///<data_dir>/rms.db` | Any SQLAlchemy URL. Backups need SQLite |
| `RMS_SECRET_KEY` | generated | Session signing key. Stored in `data/secret.key` if not set |

The database schema is migrated automatically on start.

## Develop

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
(cd frontend && npm install)
.venv/bin/python -m scripts.seed      # optional demo data (admin / admin12345)
scripts/dev.sh                        # API :8000 + UI :5173
```

Tests:

```bash
.venv/bin/pytest                                  # API
(cd frontend && npm run lint && npm test)         # UI
(cd e2e && npm install && npx playwright test)    # full journey against the production build
```

## Layout

```
backend/
  core/       config, database, security, errors, pagination, migrations
  modules/    one folder per feature: models · schemas · service · router
alembic/      schema migrations
frontend/src/
  app/        routing, layout, command palette (⌘K)
  components/ shared UI primitives
  features/   one folder per page with its data hooks
  lib/        api client, formatting, theme
```
