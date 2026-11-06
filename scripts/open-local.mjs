import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Install Node.js 24 LTS to use local application storage.');
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const require = createRequire(import.meta.url);
const stateFile = path.join(root, '.runway-local.json');
const noOpen = process.argv.includes('--no-open');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
async function isReady(url) {
  try { const response = await fetch(`${url}/api/health/`, { signal: AbortSignal.timeout(1500), cache: 'no-store' }); return response.ok && (await response.json()).ok === true; } catch { return false; }
}
function openBrowser(url) {
  if (noOpen) return;
  const browser = process.platform === 'win32'
    ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `start "" "${url}"`], { stdio: 'ignore', windowsHide: true })
    : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' });
  browser.on('error', () => console.log(`Open this address in your browser: ${url}`));
  browser.unref();
}
async function freePort() {
  const requested = Number(process.env.PORT || 3000);
  if (!Number.isInteger(requested) || requested < 1024 || requested > 65515) throw new Error('PORT must be a number between 1024 and 65515.');
  for (let port = requested; port < requested + 20; port++) {
    const free = await new Promise(resolve => {
      const server = createServer();
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
    });
    if (free) return port;
  }
  throw new Error('No available local port. Close a previous server and try again.');
}
async function main() {
  let previous;
  try { previous = JSON.parse(readFileSync(stateFile, 'utf8')); } catch { /* first launch */ }
  if (previous?.root === root && Number.isInteger(previous.pid) && alive(previous.pid) && Number.isInteger(previous.port) && previous.port >= 1024 && previous.port <= 65535) {
    const url = `http://127.0.0.1:${previous.port}`;
    console.log(`Runway Models is already starting/running: ${url}`);
    for (let attempt = 0; attempt < 120; attempt++) {
      if (await isReady(url)) { openBrowser(url); return; }
      if (!alive(previous.pid)) break;
      await delay(500);
    }
    if (alive(previous.pid)) throw new Error('The previous server is still starting. Check its terminal window.');
  }
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  console.log(`\nRUNWAY MODELS - local development\n${url}\nKeep this terminal open. Stop: Ctrl+C.\n`);
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', String(port)], { cwd: root, stdio: 'inherit', windowsHide: true });
  let exited = false;
  const clean = () => {
    try { if (JSON.parse(readFileSync(stateFile, 'utf8')).pid === child.pid) unlinkSync(stateFile); } catch { /* already removed */ }
  };
  child.once('error', error => { exited = true; clean(); console.error(error.message); process.exitCode = 1; });
  child.once('exit', code => { exited = true; clean(); process.exitCode = code || 0; });
  if (child.pid) writeFileSync(stateFile, JSON.stringify({ root, pid: child.pid, port }));
  process.once('SIGINT', () => { clean(); child.kill('SIGINT'); });
  process.once('SIGTERM', () => { clean(); child.kill('SIGTERM'); });
  for (let attempt = 0; attempt < 180 && !exited; attempt++) {
    if (await isReady(url)) { console.log(`\nReady: ${url}\n`); openBrowser(url); return; }
    await delay(500);
  }
  if (!exited) { clean(); child.kill(); throw new Error('The site did not start in time. Read the Next.js messages above and try again.'); }
}
main().catch(error => { console.error(`\n${error.message}`); process.exitCode = 1; });
