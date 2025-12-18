/* eslint-disable no-console */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const isWindows = process.platform === 'win32';

const e2eDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(e2eDir, '..');
const frontendDir = path.join(repoRoot, 'frontend');

const BACKEND_BASE = process.env.API_BASE || 'http://127.0.0.1:8000';
const FRONTEND_BASE = process.env.UI_BASE || 'http://127.0.0.1:5173';

const pythonExe = isWindows
  ? path.join(repoRoot, '.venv', 'Scripts', 'python.exe')
  : path.join(repoRoot, '.venv', 'bin', 'python');

function mkdirp(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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
    ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', '8000'],
    { cwd: repoRoot, shell: false, env: { ...process.env } },
  );

  // Start frontend
  console.log('[e2e] Starting frontend (Vite)...');
  // Use shell on Windows so `npm` resolves to npm.cmd.
  frontendProc = spawnLogged(
    'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    { cwd: frontendDir, shell: true, env: { ...process.env, VITE_API_BASE_URL: 'http://127.0.0.1:8000' } },
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
  const pwArgs = ['playwright', 'test', '-j', '1'];
  if (headed) pwArgs.push('--headed');

  const pwProc = spawnLogged('npx', pwArgs, { cwd: e2eDir, shell: true, env: { ...process.env, BASE_URL: FRONTEND_BASE } });
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
