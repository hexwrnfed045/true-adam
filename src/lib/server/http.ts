import { createHash } from "node:crypto";
import { database } from "./db";
import type { ApiError } from "@/types/api";
export class ApiFailure extends Error {
  constructor(public status: number, message: string, public fieldErrors?: Record<string, string>) { super(message); }
}
export function json(value: unknown, status = 200, headers?: HeadersInit) {
  const output = new Headers(headers); output.set("Cache-Control", "no-store"); output.set("X-Content-Type-Options", "nosniff");
  return Response.json(value, { status, headers: output });
}
export async function handle(callback: () => Response | Promise<Response>): Promise<Response> {
  try { return await callback(); }
  catch (error) {
    if (error instanceof ApiFailure) { const body: ApiError = { error: error.message }; if (error.fieldErrors) body.fieldErrors = error.fieldErrors; return json(body, error.status, error.status === 429 ? { "Retry-After": "60" } : undefined); }
    console.error("Runway API error:", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Не удалось выполнить запрос. Повторите позже." }, 500);
  }
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") throw new ApiFailure(403, "Запрос должен быть отправлен с этого сайта.");
  try {
    const incomingHost = request.headers.get("host");
    if (!incomingHost || !/^(?:[a-z0-9.-]+|\[[a-f0-9:]+\])(?::\d{1,5})?$/i.test(incomingHost)) throw new Error("Invalid host");
    const protocol = new URL(request.url).protocol;
    if (protocol !== "http:" && protocol !== "https:") throw new Error("Invalid protocol");
    // Next.js may replace request.url hostname with the internal server hostname.
    // Browser Host is the actual target authority; do not trust forwarded-host headers.
    const expectedOrigin = new URL(`${protocol}//${incomingHost}`).origin;
    if (new URL(origin).origin !== expectedOrigin) throw new Error("Origin mismatch");
  } catch { throw new ApiFailure(403, "Недопустимый источник запроса."); }
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new ApiFailure(403, "Межсайтовые запросы запрещены.");
}
export function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function rateLimit(key: string, maximum: number, duration: number) {
  const db = database(); const now = Date.now();
  db.prepare("DELETE FROM rate_limits WHERE expires_at <= ?").run(now);
  const record = db.prepare("SELECT count,expires_at FROM rate_limits WHERE key=?").get(key) as { count: number; expires_at: number } | undefined;
  if (record && record.count >= maximum) throw new ApiFailure(429, "Слишком много запросов. Подождите и повторите позже.");
  if (record) db.prepare("UPDATE rate_limits SET count=count+1 WHERE key=?").run(key);
  else db.prepare("INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?)").run(key, now + duration);
}
export async function limitedBody(request: Request, maximum: number) {
  const length = request.headers.get("content-length");
  if (length && Number(length) > maximum) throw new ApiFailure(413, "Размер запроса превышает допустимый.");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > maximum) { await reader.cancel(); throw new ApiFailure(413, "Размер запроса превышает допустимый."); } chunks.push(value); } }
  catch (error) { if (error instanceof ApiFailure) throw error; throw new ApiFailure(400, "Не удалось прочитать запрос."); }
  const all = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; } return all;
}
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ApiFailure(415, "Ожидается JSON.");
  const bytes = await limitedBody(request, 32 * 1024);
  try { const value: unknown = JSON.parse(new TextDecoder().decode(bytes)); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value as Record<string, unknown>; }
  catch { throw new ApiFailure(400, "Некорректный JSON."); }
}
export function validated<T>(result: { value: T | null; fieldErrors: Record<string, string> }): T {
  if (!result.value) throw new ApiFailure(422, "Проверьте заполнение формы.", result.fieldErrors); return result.value;
}
