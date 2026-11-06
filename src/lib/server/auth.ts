import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { database } from "./db";
import { ApiFailure, digest } from "./http";
import type { User } from "@/types/api";
const scryptAsync = promisify(scrypt);
const COOKIE = "runway-session";
const SESSION_AGE = 30 * 24 * 60 * 60;
type UserRow = { id: string; name: string; email: string; city: string; role: "member" | "admin"; created_at: string; password_hash: string; };
export function publicUser(row: UserRow): User { return { id: row.id, name: row.name, email: row.email, city: row.city, role: row.role, createdAt: row.created_at }; }
export function userByEmail(email: string) { return database().prepare("SELECT * FROM users WHERE email=? COLLATE NOCASE").get(email) as UserRow | undefined; }
export function userById(id: string) { return database().prepare("SELECT * FROM users WHERE id=?").get(id) as UserRow | undefined; }
export async function hashPassword(password: string) { const salt = randomBytes(16).toString("hex"); const key = await scryptAsync(password, salt, 64) as Buffer; return `scrypt$${salt}$${key.toString("hex")}`; }
export async function verifyPassword(password: string, stored?: string) {
  const parts = stored?.split("$"); const valid = parts?.length === 3 && parts[0] === "scrypt" && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2]);
  const key = await scryptAsync(password, valid ? parts![1] : "runway-nonexistent-account-salt", 64) as Buffer;
  return !!valid && timingSafeEqual(key, Buffer.from(parts![2], "hex"));
}
export function requestToken(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const value = cookie.split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return value && /^[a-zA-Z0-9_-]{43}$/.test(value) ? value : null;
}
export function sessionUser(request: Request): User | null {
  const token = requestToken(request); if (!token) return null;
  const db = database(); const row = db.prepare("SELECT users.*,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=?").get(digest(token)) as (UserRow & { expires_at: number }) | undefined;
  if (!row) return null; if (row.expires_at <= Date.now()) { db.prepare("DELETE FROM sessions WHERE token_hash=?").run(digest(token)); return null; } return publicUser(row);
}
export function requireUser(request: Request) { const user = sessionUser(request); if (!user) throw new ApiFailure(401, "Войдите в аккаунт, чтобы продолжить."); return user; }
export function requireAdmin(request: Request) { const user = requireUser(request); if (user.role !== "admin") throw new ApiFailure(403, "Недостаточно прав."); return user; }
export function createSession(userId: string, request: Request) {
  deleteSession(request); const token = randomBytes(32).toString("base64url"); const now = Date.now();
  database().prepare("DELETE FROM sessions WHERE expires_at<=?").run(now);
  database().prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").run(digest(token), userId, now + SESSION_AGE * 1000, new Date(now).toISOString()); return token;
}
export function deleteSession(request: Request) { const token = requestToken(request); if (token) database().prepare("DELETE FROM sessions WHERE token_hash=?").run(digest(token)); }
export function sessionCookie(request: Request, token: string | null) { return `${COOKIE}=${token || ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_AGE : 0}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`; }
