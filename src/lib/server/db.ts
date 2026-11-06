import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

export function dataDirectory() { return path.resolve(/* turbopackIgnore: true */ process.env.RUNWAY_DATA_DIR || path.join(process.cwd(), ".runway-data")); }
export function uploadsDirectory() { return path.join(dataDirectory(), "uploads"); }
const migrated = new WeakSet<DatabaseSync>();
function migrate(db: DatabaseSync) {
  if (migrated.has(db)) return;
  const columns = db.prepare("PRAGMA table_info(applications)").all() as { name: string }[];
  if (!columns.some(column => column.name === "age")) db.exec("ALTER TABLE applications ADD COLUMN age INTEGER");
  if (!columns.some(column => column.name === "request_fingerprint")) db.exec("ALTER TABLE applications ADD COLUMN request_fingerprint TEXT NOT NULL DEFAULT ''");
  db.exec("PRAGMA user_version=2"); migrated.add(db);
}
const shared = globalThis as typeof globalThis & { runwayDatabases?: Map<string, DatabaseSync> };
export function database() {
  const directory = dataDirectory();
  shared.runwayDatabases ??= new Map();
  const existing = shared.runwayDatabases.get(directory);
  if (existing) { migrate(existing); return existing; }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  mkdirSync(uploadsDirectory(), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(directory, "runway.sqlite"));
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, city TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL CHECK(type IN ('model','viewer','course','collaboration')), title TEXT NOT NULL,
      target_id TEXT, model_id TEXT, status TEXT NOT NULL CHECK(status IN ('submitted','reviewing','accepted','rejected','withdrawn','waiting')),
      name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, city TEXT NOT NULL,
      height INTEGER, age INTEGER, measurements TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
      project_type TEXT NOT NULL DEFAULT '', project_date TEXT NOT NULL DEFAULT '',
      idempotency_key TEXT NOT NULL, dedupe_key TEXT NOT NULL, request_fingerprint TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, admin_note TEXT NOT NULL DEFAULT '',
      UNIQUE(user_id, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS applications_user ON applications(user_id,created_at);
    CREATE INDEX IF NOT EXISTS applications_target ON applications(type,target_id,status);
    CREATE UNIQUE INDEX IF NOT EXISTS active_application ON applications(user_id,dedupe_key)
      WHERE status IN ('submitted','reviewing','accepted','waiting');
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL, size INTEGER NOT NULL, content_type TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS application_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT, application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      status TEXT NOT NULL, at TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', actor_id TEXT NOT NULL REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, model_id TEXT NOT NULL,
      PRIMARY KEY(user_id,model_id)
    );
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT NOT NULL, action TEXT NOT NULL, target_id TEXT NOT NULL, at TEXT NOT NULL, details TEXT NOT NULL DEFAULT '');
    PRAGMA user_version = 1;
  `);
  migrate(db);
  shared.runwayDatabases.set(directory, db);
  return db;
}
export function transaction<T>(callback: () => T): T {
  const db = database();
  db.exec("BEGIN IMMEDIATE");
  try { const result = callback(); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
