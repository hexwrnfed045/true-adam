import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

export function dataDirectory() { return path.resolve(/* turbopackIgnore: true */ process.env.RUNWAY_DATA_DIR || path.join(process.cwd(), ".runway-data")); }
export function uploadsDirectory() { return path.join(dataDirectory(), "uploads"); }
const migrated = new WeakSet<DatabaseSync>();
function migrate(db: DatabaseSync) {
  if (migrated.has(db)) return;
  // SQLite requires foreign_keys to be changed outside a transaction when
  // replacing a referenced table. Keep the original IDs and verify every FK
  // before committing, so existing sessions, applications and files survive.
  db.exec("PRAGMA foreign_keys=OFF");
  try {
    db.exec("BEGIN IMMEDIATE");
    try {
      const applications = db.prepare("PRAGMA table_info(applications)").all() as { name: string }[];
      if (!applications.some(column => column.name === "age")) db.exec("ALTER TABLE applications ADD COLUMN age INTEGER");
      if (!applications.some(column => column.name === "request_fingerprint")) db.exec("ALTER TABLE applications ADD COLUMN request_fingerprint TEXT NOT NULL DEFAULT ''");
      const users = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
      const profileColumns = {
        phone: "TEXT NOT NULL DEFAULT ''",
        birth_date: "TEXT NOT NULL DEFAULT ''",
        height: "INTEGER",
        chest: "INTEGER",
        waist: "INTEGER",
        hips: "INTEGER",
        experience: "TEXT NOT NULL DEFAULT ''",
      };
      for (const [name, definition] of Object.entries(profileColumns)) {
        if (!users.some(column => column.name === name)) db.exec(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
      }
      const definition = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as { sql: string };
      if (!definition.sql.includes("'viewer'")) {
        db.exec(`
          CREATE TABLE users_roles_v4 (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL, city TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('viewer','model','organizer','brand','agent','moderator','admin')),
            created_at TEXT NOT NULL,
            phone TEXT NOT NULL DEFAULT '', birth_date TEXT NOT NULL DEFAULT '',
            height INTEGER, chest INTEGER, waist INTEGER, hips INTEGER,
            experience TEXT NOT NULL DEFAULT ''
          );
          INSERT INTO users_roles_v4(id,name,email,password_hash,city,role,created_at,phone,birth_date,height,chest,waist,hips,experience)
            SELECT id,name,email,password_hash,city,CASE role WHEN 'member' THEN 'viewer' ELSE role END,
              created_at,phone,birth_date,height,chest,waist,hips,experience FROM users;
          DROP TABLE users;
          ALTER TABLE users_roles_v4 RENAME TO users;
        `);
      }
      db.exec(`
        CREATE TABLE IF NOT EXISTS application_templates (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK(type IN ('model','viewer','course','collaboration')),
          application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
          PRIMARY KEY(user_id,type)
        );
      `);
      if (db.prepare("PRAGMA foreign_key_check").all().length) {
        throw new Error("Database migration would leave invalid references; changes were rolled back.");
      }
      db.exec("PRAGMA user_version=5; COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.exec("PRAGMA foreign_keys=ON");
  }
  migrated.add(db);
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
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL, city TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('viewer','model','organizer','brand','agent','moderator','admin')),
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
