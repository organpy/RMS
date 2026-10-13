import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { defineConfig } from '@playwright/test'

const port = 8765
const dataDir = mkdtempSync(join(tmpdir(), 'rms-e2e-'))
const python = process.env.PYTHON ?? '.venv/bin/python'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    // Serves the production build from the API process, exactly as end users run it.
    command: `cd .. && (cd frontend && npm run build) && ${python} -m backend`,
    url: `http://127.0.0.1:${port}/api/health`,
    env: { RMS_DATA_DIR: dataDir, RMS_PORT: String(port) },
    timeout: 120_000,
    reuseExistingServer: false,
  },
})
