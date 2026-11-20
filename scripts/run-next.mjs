import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const env = { ...process.env };
// Serial filesystem operations avoid Windows EPERM races while Next emits
// several route directories at once. Respect an explicit owner setting.
if (process.platform === 'win32') env.UV_THREADPOOL_SIZE ||= '1';
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), ...process.argv.slice(2)], {
  stdio: 'inherit', env, windowsHide: true,
});
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
process.once('SIGINT', () => child.kill('SIGINT'));
process.once('SIGTERM', () => child.kill('SIGTERM'));
