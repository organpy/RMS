# E2E test scaffolding (Playwright)

This folder contains a minimal Playwright setup for Phase 10 E2E tests. It's intentionally minimal; if you'd like I can wire Playwright into CI with browsers and a test server.

To run locally (example):

1. Install Playwright in the frontend folder: `cd frontend && npx playwright install`.
2. Start backend and frontend dev servers (see `docs/developer_guide.md`).
3. Run `npx playwright test` from the workspace root or the `e2e` folder depending on your setup.

Example tests live in `e2e/tests/`.

CI notes:
- The smoke test(s) should run after the frontend dev server is started. In CI, start the frontend build in the background (or use a static preview) before running `npx playwright test`.
- Playwright browsers can be installed via `npx playwright install --with-deps` in CI images that need extra packages.

Next steps:
- Implement the remaining E2E journeys in `e2e/tests/` (4 more planned).
- Add a lightweight CI job that runs a smoke test using a preview build of the frontend or starts the dev server in background.

Seeding test data (optional but recommended for Journey 2):

1. Ensure the backend API is running locally (default `http://127.0.0.1:8000`).
2. From the `e2e` folder run:

```powershell
npm install
npm run seed
```

This posts two simple members to `/api/members` so the Members page has rows to operate on. You can override the API base URL with `API_BASE=http://127.0.0.1:8001 npm run seed`.
