<div align="center">

<img src="docs/assets/banner.png" alt="RMS banner" width="100%">

# RMS

**Membership and subscription management for schools, gyms, studios and clubs.**
Courses, groups, plans, payments, invoices, attendance and reminders, running on your own computer.

![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)

[Features](#features) · [Quick start](#quick-start) · [Daily workflow](#daily-workflow) · [Messaging setup](#messaging-setup) · [Your network](#run-it-on-your-network) · [Development](#development) · [Troubleshooting](#troubleshooting)

</div>

---

RMS is for anyone who runs **courses**, splits them into **groups**, and charges **members** on a recurring **plan**: a private school, a gym, a music studio, a swim club. There is no cloud account and no subscription. Everything lives in a single SQLite file on the machine that runs it, and you can reach it from other devices on your network.

## Features

| Area | What it does |
|---|---|
| **Members** | Search, filters, CSV import and export. Status (active, due, overdue) is derived from what each member has actually paid. Per-member discounts, parent or guardian contacts, and an outstanding balance. |
| **Courses and groups** | A roster page per course with its members split by group, capacity bars, moving members between groups, a print layout and a "message this group" action. |
| **Plans and payments** | Each payment extends the member's coverage. Partial payments leave a balance that can be settled later. Refunds roll coverage back. |
| **Invoices** | Numbered PDF invoices. One A4 sheet holds two copies, **Customer copy** and **Office copy**, with a cut line and signature boxes. Cut it, hand one half over and keep the other. Invoices can also be emailed as a PDF. |
| **Messaging** | Email through your SMTP server, SMS and WhatsApp through Twilio. Reminders, announcements to a course or group, a full message history with retry, and optional automatic reminders. |
| **Attendance** | Take attendance per group and day (present, late, absent). See attendance rates on the roster and download a register as CSV. |
| **Money** | A printable daily cash report by payment method and by staff member, plus an expenses log with categories. |
| **Analytics** | Collected, expenses and profit against the previous period, average per paying member, collection rate, lapsed members, expected renewals for the next 30, 60 and 90 days, overdue ageing, and revenue by method, plan, course and group. |
| **Staff** | Admin and staff roles, scrypt-hashed passwords, httpOnly session cookies, and an **activity log** of who changed what. |
| **Backups** | One-click or scheduled snapshots, and a validated restore that also accepts backups made by older versions. |

## Quick start

Requires **Python 3.11+** and **Node 20+**.

```bash
git clone <this repository> rms && cd rms
scripts/start.sh
```

Open http://127.0.0.1:8000. On first launch you create your organization and the admin account. The script creates a virtual environment, installs dependencies, builds the interface and starts everything in one process. The database schema is migrated automatically on every start.

### Configuration

Settings come from environment variables or a `.env` file in the project folder. Copy `.env.example` to get started; every value is optional.

| Variable | Default | Purpose |
|---|---|---|
| `RMS_HOST` / `RMS_PORT` | `127.0.0.1` / `8000` | Where the server listens |
| `RMS_DATA_DIR` | `./data` | Database, backups, logo and the generated secret key |
| `RMS_DATABASE_URL` | `sqlite:///<data_dir>/rms.db` | Any SQLAlchemy URL. Backups need SQLite |
| `RMS_SECRET_KEY` | generated | Session signing key, stored in `data/secret.key` when not set |
| `RMS_SECURE_COOKIES` | `false` | Set to `true` when served over HTTPS |
| `RMS_SMTP_HOST` | | Your outgoing mail server. Setting it enables email |
| `RMS_SMTP_PORT` | `587` | |
| `RMS_SMTP_SECURITY` | `starttls` | `starttls`, `ssl` or `none` |
| `RMS_SMTP_USER` / `RMS_SMTP_PASSWORD` | | Login for the mail server |
| `RMS_SMTP_FROM` | | Sender address shown to members |
| `RMS_TWILIO_SID` / `RMS_TWILIO_TOKEN` | | Twilio credentials, needed for SMS and WhatsApp |
| `RMS_TWILIO_SMS_FROM` | | Twilio number that sends SMS. Setting it enables SMS |
| `RMS_TWILIO_WHATSAPP_FROM` | | WhatsApp sender. Setting it enables WhatsApp |

Credentials only ever live in `.env`. They are never stored in the database or shown in the app, and `.env` is git-ignored.

## Daily workflow

<details>
<summary><b>First run and organization settings</b></summary>

<br>

After creating the admin account, open **Settings** to add your organization details, logo, accent colour, currency and language. These appear on invoices. The **grace period** is how many days a member stays "due" before becoming "overdue".

Add staff under **Settings → Staff**. Admins manage settings, staff and backups; staff handle members and payments.

</details>

<details>
<summary><b>Courses, groups and plans</b></summary>

<br>

1. **Courses** → **New course** (for example *Grade 5*, *Piano*, *CrossFit*), then add groups such as time slots or levels. A group can have a schedule and a capacity.
2. **Plans** → **New plan** with a price and a length in days. A plan can be limited to one course.
3. Click a course name to open its **roster**: members per group, capacity bars, attendance rates, and actions to move a member, print the list or message the group.

</details>

<details>
<summary><b>Members, discounts and CSV import</b></summary>

<br>

Add members one at a time from **Members → New member**, or in bulk with **Import**:

1. Download the template from the import dialog, or use any spreadsheet saved as CSV. Only first and last name are required.
2. Courses, groups and plans are matched by name. Dates look like `2026-09-01`.
3. The dialog first checks every row and lists problems. Nothing is saved until you confirm, and invalid rows are skipped. Files up to 2 MB or 5,000 rows are accepted, and people who already exist are not duplicated.

Set a **discount (%)** on a member to reduce their plan price when you record payments. For children, fill in the **parent or guardian** section: messages and invoices then go to the guardian first.

</details>

<details>
<summary><b>Payments, invoices and balances</b></summary>

<br>

**Payments → Record payment** (or use the button on a member). Choose the plan or a one-off payment, check the amount, the method and the date. The dialog shows the period that will be covered.

- **Partial payment**: enter less than the price. The member keeps the coverage and owes the difference, shown on their profile, in the list and on the invoice.
- **Settle a balance**: choose *Settle balance* in the "For" menu.
- **Invoice**: opens right after recording. It prints two copies on one A4 sheet. Cut along the dashed line, give the **Customer copy** to the member and keep the **Office copy**. Each has a signature line for the staff member and the customer. Add a refund policy or bank details under **Settings → Billing → Invoice footer**.
- **Email invoice**: tick the box in the dialog, or use the row menu later. Emailed invoices are a single-page PDF.
- **Refund** from the row menu: coverage is recalculated and the invoice is stamped REFUNDED.

</details>

<details>
<summary><b>Reminders and messaging</b></summary>

<br>

**Reminders** lists everyone whose coverage has ended, with their last reminder date and any balance. Send to one member from the row, or tick several and send in bulk.

If a channel is connected (see [Messaging setup](#messaging-setup)) the message is sent by the server and logged. Otherwise the app opens your email, SMS or WhatsApp app with the message filled in, and logs that you did it.

- Edit the wording under **Settings → Reminders**. Placeholders: `{first_name}`, `{last_name}`, `{plan}`, `{amount}`, `{balance}`, `{due_date}`, `{organization}`.
- Send an **announcement** to a whole course or group from its roster, or to one member from their profile (**⋯ → Send message**).
- Every message, with its status and any error, appears on the member's **Messages** tab. Failed ones can be retried.
- Turn on **automatic reminders** under Settings to send one a few days before coverage ends and one a few days after. Each coverage period is reminded at most once in each direction, using email first, then WhatsApp, then SMS.

</details>

<details>
<summary><b>Attendance</b></summary>

<br>

Open a course roster and use the clipboard icon on a group. Pick the date, mark each member present, late or absent (or **Mark all present** first), and save. Saving again for the same date updates it.

Attendance rates for the last 90 days appear next to each member on the roster. **Register** in the same dialog downloads the last 30 days as a CSV.

</details>

<details>
<summary><b>Expenses and the daily cash report</b></summary>

<br>

**Expenses** records what you spend (rent, salaries, equipment) with a category and date. Categories you have used are suggested next time.

**Payments → Daily report** is the end-of-day cash-up: total collected, takings by method, by staff member, every payment, refunds and expenses for the chosen date. Use **Print** to keep a paper copy.

**Analytics** combines both into profit. Pick a range (this month, last 6 months, or custom dates) and compare against the previous period of the same length.

</details>

<details>
<summary><b>Backups and restore</b></summary>

<br>

**Settings → Backups** creates snapshots of the database and logo, and can do so automatically every day or week while keeping the most recent ones. Download a snapshot to store it somewhere else.

To restore, upload a backup file. The app checks it, saves a **pre-restore** snapshot of the current data, and then swaps it in. Backups made by older versions of the app are upgraded to the current schema first, and a backup from a newer version is refused.

</details>

## Messaging setup

Credentials go in `.env`, then restart the app. **Settings → Messaging** shows which channels are connected and has a **Send test** button.

<details>
<summary><b>Gmail</b></summary>

<br>

Turn on 2-step verification for the account, then create an **app password** (Google Account → Security → App passwords).

```env
RMS_SMTP_HOST=smtp.gmail.com
RMS_SMTP_PORT=587
RMS_SMTP_SECURITY=starttls
RMS_SMTP_USER=you@gmail.com
RMS_SMTP_PASSWORD=abcdefghijklmnop
RMS_SMTP_FROM=you@gmail.com
```

</details>

<details>
<summary><b>Any other SMTP server</b></summary>

<br>

Use the details from your mail provider. Port 465 normally means `ssl`, port 587 means `starttls`, and a local relay may use `none`.

```env
RMS_SMTP_HOST=mail.example.com
RMS_SMTP_PORT=465
RMS_SMTP_SECURITY=ssl
RMS_SMTP_USER=office@example.com
RMS_SMTP_PASSWORD=...
RMS_SMTP_FROM=office@example.com
```

</details>

<details>
<summary><b>SMS and WhatsApp with Twilio</b></summary>

<br>

Create a [Twilio](https://www.twilio.com) account and copy the **Account SID** and **Auth token** from the console.

```env
RMS_TWILIO_SID=AC...
RMS_TWILIO_TOKEN=...
RMS_TWILIO_SMS_FROM=+15550001111
RMS_TWILIO_WHATSAPP_FROM=+14155238886
```

- **SMS** needs a Twilio phone number that can send messages.
- **WhatsApp** can start with Twilio's sandbox: use the sandbox number as the sender, and each recipient must first send the sandbox's join code to it. For real use, register your own WhatsApp sender with Twilio. Write the number without the `whatsapp:` prefix; the app adds it.
- Phone numbers on members should include the country code, for example `+15551234567`.

</details>

## Run it on your network

Bind to all interfaces so tablets or other computers can reach it:

```bash
RMS_HOST=0.0.0.0 scripts/start.sh
```

Then open `http://<this-computer's-ip>:8000`. Only do this on networks you trust. If you put the app behind a reverse proxy with HTTPS, set `RMS_SECURE_COOKIES=true`. To keep it running after you close the terminal, run `python -m backend` from a service manager such as systemd.

## Development

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
(cd frontend && npm install)
.venv/bin/python -m scripts.seed      # optional demo data (admin / admin12345)
scripts/dev.sh                        # API on :8000, UI on :5173 with hot reload
```

The seed script accepts `--members N` for a bigger demo. It signs in as `admin` / `admin12345`.

```bash
.venv/bin/pytest                                  # API tests
(cd frontend && npm run lint && npm test)         # UI lint and unit tests
(cd e2e && npm install && npx playwright test)    # full journey against the production build
```

Schema changes use Alembic: change a model, start the app once so your database is up to date, then run `.venv/bin/alembic revision --autogenerate -m "what changed"` and review the generated file in `alembic/versions/`. Migrations run automatically on start.

## Project layout

```
backend/
  core/         config, database, security, errors, pagination, migrations, background jobs
  modules/      one folder per feature: models · schemas · service · router
                members · payments · invoices · messaging · attendance · courses · plans
                expenses · reports · analytics · reminders · staff · audit · backups · organization
alembic/        schema migrations
frontend/src/
  app/          routing, layout, command palette (⌘K)
  components/   shared UI primitives
  features/     one folder per page with its data hooks
  lib/          api client, formatting, report ranges, theme
e2e/            Playwright journey against the production build
docs/assets/    README images (banner.png)
```

## Troubleshooting

**The port is already in use.** Set another one: `RMS_PORT=8010 scripts/start.sh`.

**A channel says "not connected" in Settings → Messaging.** Check the variable names in `.env`, make sure the file sits in the folder you start the app from, and restart. The app lists which variables each channel needs.

**An email or SMS failed.** Open the member's **Messages** tab: the error from the provider is shown there, and you can retry once it is fixed. Gmail needs an app password, not your normal password.

**I forgot the admin password.** Another admin can reset it in Settings → Staff. If you are the only admin, run this from the project folder (use your own `RMS_DATA_DIR` if you changed it):

```bash
.venv/bin/python - <<'PY'
from backend.core.db import session_scope
from backend.core.security import hash_password
from backend.modules.staff.models import Staff

with session_scope() as db:
    db.query(Staff).filter_by(username="admin").one().password_hash = hash_password("choose-a-new-password")
PY
```

**A restore was refused.** The file must be a backup made by this app, and not from a newer version. Update the app first if the backup came from a newer install.
