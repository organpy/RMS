/* eslint-disable no-console */

const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const fetch = require('node-fetch');

const isWindows = process.platform === 'win32';

const e2eDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(e2eDir, '..');
const frontendDir = path.join(repoRoot, 'frontend');

const DEFAULT_BACKEND_PORT = Number(process.env.BACKEND_PORT || 8000);
const DEFAULT_FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 5173);

const pythonExe = isWindows
  ? path.join(repoRoot, '.venv', 'Scripts', 'python.exe')
  : path.join(repoRoot, '.venv', 'bin', 'python');

const playwrightExe = isWindows
  ? path.join(e2eDir, 'node_modules', '.bin', 'playwright.cmd')
  : path.join(e2eDir, 'node_modules', '.bin', 'playwright');

function mkdirp(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function isPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, host);
  });
}

async function findAvailablePort(startPort, host = '127.0.0.1', maxTries = 25) {
  let port = startPort;
  for (let i = 0; i < maxTries; i++) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(port, host)) return port;
    port += 1;
  }
  throw new Error(`Could not find an available port starting at ${startPort}`);
}

async function waitForUrl(url, timeoutMs = 60_000) {
  const start = Date.now();
  let lastErr = null;

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
      lastErr = new Error(`Non-OK response: ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`Timed out waiting for ${url}. Last error: ${lastErr ? lastErr.message : 'unknown'}`);
}

function spawnLogged(command, args, options) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    cwd: options?.cwd,
    env: options?.env,
    shell: options?.shell ?? false,
  });

  child.on('exit', (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      // Don't throw here; caller decides whether nonzero is fatal.
      console.warn(`[process-exit] ${command} exited with code ${code}`);
    }
  });

  return child;
}

async function killTree(child) {
  if (!child || child.killed) return;

  if (isWindows) {
    // taskkill reliably terminates node/python trees on Windows.
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', shell: true });
    return;
  }

  try {
    child.kill('SIGTERM');
  } catch {
    // ignore
  }
}

async function main() {
  const headed = process.argv.includes('--headed');

  const backendPort = await findAvailablePort(DEFAULT_BACKEND_PORT);
  const frontendPort = await findAvailablePort(DEFAULT_FRONTEND_PORT);
  const BACKEND_BASE = `http://127.0.0.1:${backendPort}`;
  const FRONTEND_BASE = `http://127.0.0.1:${frontendPort}`;

  // Ensure local data dirs exist (backend defaults to ./data/app.db)
  mkdirp(path.join(repoRoot, 'data'));
  mkdirp(path.join(repoRoot, 'data', 'receipts'));
  mkdirp(path.join(repoRoot, 'data', 'backups'));

  let backendProc = null;
  let frontendProc = null;

  const cleanup = async () => {
    await killTree(frontendProc);
    await killTree(backendProc);
  };

  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(130);
  });

  process.on('exit', () => {
    // best effort
    cleanup();
  });

  // Start backend
  if (!fs.existsSync(pythonExe)) {
    throw new Error(`Python executable not found at ${pythonExe}. Activate/create .venv first.`);
  }

  console.log('[e2e] Starting backend...');
  backendProc = spawnLogged(
    pythonExe,
    ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', String(backendPort)],
    { cwd: repoRoot, shell: false, env: { ...process.env } },
  );

  // Start frontend
  console.log('[e2e] Starting frontend (Vite)...');
  // Use shell on Windows so `npm` resolves to npm.cmd.
  frontendProc = spawnLogged(
    'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'],
    { cwd: frontendDir, shell: true, env: { ...process.env, VITE_API_BASE_URL: BACKEND_BASE } },
  );

  // Wait for readiness
  console.log('[e2e] Waiting for backend health...');
  await waitForUrl(`${BACKEND_BASE}/api/health`, 60_000);
  console.log('[e2e] Waiting for frontend...');
  await waitForUrl(`${FRONTEND_BASE}/`, 60_000);

  // Seed minimal data
  console.log('[e2e] Seeding test data...');
  const seedProc = spawnLogged(
    'node',
    [path.join(e2eDir, 'setup', 'seed.js')],
    { cwd: e2eDir, shell: true, env: { ...process.env, API_BASE: BACKEND_BASE } },
  );

  const seedExitCode = await new Promise((resolve) => {
    seedProc.on('close', (code) => resolve(code ?? 0));
  });

  if (seedExitCode !== 0) {
    console.warn('[e2e] Seeder failed; continuing anyway');
  }

  // Run Playwright
  console.log('[e2e] Running Playwright...');
  if (!fs.existsSync(playwrightExe)) {
    throw new Error(`Playwright executable not found at ${playwrightExe}. Run npm install in e2e/.`);
  }

  const pwArgs = ['test', '-j', '1'];
  if (headed) pwArgs.push('--headed');

  const pwProc = spawnLogged(playwrightExe, pwArgs, {
    cwd: e2eDir,
    shell: true,
    env: { ...process.env, BASE_URL: FRONTEND_BASE, API_BASE: BACKEND_BASE },
  });
  const exitCode = await new Promise((resolve) => {
    pwProc.on('close', (code) => resolve(code ?? 1));
  });

  await cleanup();
  process.exit(exitCode);
}

main().catch(async (err) => {
  console.error('[e2e] Failed:', err);
  process.exit(1);
});
