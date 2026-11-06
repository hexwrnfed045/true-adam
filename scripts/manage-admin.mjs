import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const args = process.argv.slice(2);
const emailIndex = args.indexOf('--email');
const roleIndex = args.indexOf('--role');
const email = emailIndex >= 0 ? args[emailIndex + 1]?.trim().toLowerCase() : '';
const role = roleIndex >= 0 ? args[roleIndex + 1] : 'admin';
const allowed = new Set([emailIndex, emailIndex + 1, ...(roleIndex >= 0 ? [roleIndex, roleIndex + 1] : [])]);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['admin', 'member'].includes(role) || args.some((_, index) => !allowed.has(index))) {
  console.error('Usage: npm run admin -- --email existing-user@example.com [--role admin|member]'); process.exit(1);
}
const directory = path.resolve(process.env.RUNWAY_DATA_DIR || path.join(root, '.runway-data'));
const filename = path.join(directory, 'runway.sqlite');
if (!existsSync(filename)) { console.error('Database not found. Start the site and register your account first.'); process.exit(1); }
const db = new DatabaseSync(filename);
db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
try {
  const user = db.prepare('SELECT id,email,role FROM users WHERE email=? COLLATE NOCASE').get(email);
  if (!user) throw new Error('User not found. Register the account through the site first.');
  if (role === 'member' && user.role === 'admin' && db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n <= 1) throw new Error('Cannot remove the last administrator. Promote another account first.');
  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, user.id);
  db.prepare('INSERT INTO audit_log(actor_id,action,target_id,at,details) VALUES(?,?,?,?,?)').run('local-cli', 'user.role', user.id, new Date().toISOString(), role);
  db.exec('COMMIT');
  console.log(`Updated ${user.email}: ${role}. Refresh the account page.`);
} catch (error) { db.exec('ROLLBACK'); console.error(error.message); process.exitCode = 1; }
finally { db.close(); }
