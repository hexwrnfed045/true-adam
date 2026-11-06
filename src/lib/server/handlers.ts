import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeEmail, validateRegister, validateLogin, validateProfile, validatePasswordChange, validateApplicationFields, APPLICATION_STATUSES } from "@/lib/validation";
import { models } from "@/data/models";
import type { ApplicationStatus, User } from "@/types/api";
import { applicationById, createApplication, idempotentApplication, listApplications, privatePhoto, reviewApplication, validateApplicationTarget, withdrawApplication } from "./applications";
import { createSession, deleteSession, hashPassword, publicUser, requireAdmin, requireUser, sessionCookie, sessionUser, userByEmail, userById, verifyPassword } from "./auth";
import { database, transaction, uploadsDirectory } from "./db";
import { ApiFailure, assertOrigin, digest, handle, json, rateLimit, readJson, validated } from "./http";
import { applicationFingerprint, preparePhotos, readMultipart } from "./uploads";

type IdContext = { params: Promise<{ id: string }> };
const minute = 60_000;
function mutation(request: Request, user?: User) { assertOrigin(request); if (user) rateLimit(`mutation:${user.id}`, 60, minute); }
export function authMe(request: Request) { return handle(() => json({ user: sessionUser(request) })); }
export function authRegister(request: Request) { return handle(async () => {
  mutation(request); rateLimit("registration:local", 20, 60 * minute); const input = validated(validateRegister(await readJson(request)));
  if (userByEmail(input.email)) throw new ApiFailure(409, "Аккаунт с этим email уже существует.", { email: "Используйте вход или другой email." });
  const passwordHash = await hashPassword(input.password);
  const result = transaction(() => { if (userByEmail(input.email)) throw new ApiFailure(409, "Аккаунт с этим email уже существует."); const id = randomUUID(); database().prepare("INSERT INTO users(id,name,email,password_hash,city,role,created_at) VALUES(?,?,?,?,?,'member',?)").run(id, input.name, input.email, passwordHash, input.city, new Date().toISOString()); return { user: publicUser(userById(id)!), token: createSession(id, request) }; });
  return json({ user: result.user }, 201, { "Set-Cookie": sessionCookie(request, result.token) });
}); }
export function authLogin(request: Request) { return handle(async () => {
  mutation(request); rateLimit("login:local", 120, 15 * minute); const input = validated(validateLogin(await readJson(request))); rateLimit(`login:${digest(input.email)}`, 12, 15 * minute);
  const row = userByEmail(input.email); const valid = await verifyPassword(input.password, row?.password_hash);
  if (!row || !valid) throw new ApiFailure(401, "Неверный email или пароль."); const token = createSession(row.id, request);
  return json({ user: publicUser(row) }, 200, { "Set-Cookie": sessionCookie(request, token) });
}); }
export function authLogout(request: Request) { return handle(() => { mutation(request); deleteSession(request); return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(request, null) }); }); }
export function profileUpdate(request: Request) { return handle(async () => { const user = requireUser(request); mutation(request, user); const body = await readJson(request); if (body.email !== undefined && normalizeEmail(String(body.email)) !== user.email) throw new ApiFailure(422, "Email аккаунта нельзя изменить в этой форме.", { email: "Email доступен только для чтения." }); const input = validated(validateProfile(body)); database().prepare("UPDATE users SET name=?,city=? WHERE id=?").run(input.name, input.city, user.id); return json({ user: publicUser(userById(user.id)!) }); }); }
export function authPassword(request: Request) { return handle(async () => {
  const user = requireUser(request); mutation(request, user); rateLimit(`password:${user.id}`, 10, 60 * minute); const input = validated(validatePasswordChange(await readJson(request)));
  if (!(await verifyPassword(input.currentPassword, userById(user.id)!.password_hash))) throw new ApiFailure(422, "Текущий пароль неверен.", { currentPassword: "Проверьте текущий пароль." }); const passwordHash = await hashPassword(input.newPassword);
  const token = transaction(() => { database().prepare("UPDATE users SET password_hash=? WHERE id=?").run(passwordHash, user.id); database().prepare("DELETE FROM sessions WHERE user_id=?").run(user.id); return createSession(user.id, request); });
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(request, token) });
}); }
export function applicationsGet(request: Request) { return handle(() => { const user = requireUser(request); return json({ applications: listApplications(user.id) }); }); }
export function applicationGet(request: Request, context: IdContext) { return handle(async () => { const user = requireUser(request); const { id } = await context.params; const application = applicationById(id); if (!application || application.userId !== user.id) throw new ApiFailure(404, "Заявка не найдена."); return json({ application }); }); }
export function applicationsPost(request: Request) { return handle(async () => {
  const user = requireUser(request); mutation(request, user); const form = await readMultipart(request); const fields: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) { if (key === "photos") continue; if (typeof value !== "string" || fields[key] !== undefined) throw new ApiFailure(422, "Некорректные поля формы."); fields[key] = value; }
  const input = validated(validateApplicationFields(fields)); if (input.email !== user.email) throw new ApiFailure(422, "Email заявки должен совпадать с email вашего аккаунта.", { email: "Используйте email аккаунта." });
  const fingerprint = await applicationFingerprint(input, form);
  const previous = idempotentApplication(user.id, input.idempotencyKey, fingerprint); if (previous) { if (previous.type !== input.type || previous.targetId !== input.targetId || previous.modelId !== input.modelId) throw new ApiFailure(409, "Идентификатор отправки уже использован. Обновите форму."); return json({ application: previous }); }
  rateLimit(`application:${user.id}`, 30, 60 * minute); validateApplicationTarget(input); const photos = await preparePhotos(form, input.type === "model"); const result = createApplication(user, input, photos, fingerprint); return json({ application: result.application }, result.repeated ? 200 : 201);
}); }
export function applicationPatch(request: Request, context: IdContext) { return handle(async () => { const user = requireUser(request); mutation(request, user); const { id } = await context.params; const body = await readJson(request); if (body.action !== "withdraw") throw new ApiFailure(422, "Допустимое действие: отозвать заявку."); return json({ application: withdrawApplication(user, id) }); }); }
export function uploadGet(request: Request, context: IdContext) { return handle(async () => {
  const user = requireUser(request); const { id } = await context.params; const photo = privatePhoto(id); if (!photo || (user.role !== "admin" && photo.user_id !== user.id)) throw new ApiFailure(404, "Фотография не найдена."); if (!/^[a-f0-9-]{36}\.jpg$/.test(photo.file_name)) throw new ApiFailure(404, "Фотография не найдена.");
  let data: Buffer; try { data = readFileSync(path.join(uploadsDirectory(), photo.file_name)); } catch { throw new ApiFailure(404, "Фотография не найдена."); }
  return new Response(new Uint8Array(data), { headers: { "Content-Type": photo.content_type, "Content-Length": String(data.length), "X-Content-Type-Options": "nosniff", "Content-Disposition": `inline; filename="${photo.id}.jpg"`, "Cache-Control": "private, no-store" } });
}); }
export function favoritesGet(request: Request) { return handle(() => { const user = requireUser(request); const ids = (database().prepare("SELECT model_id FROM favorites WHERE user_id=? ORDER BY rowid").all(user.id) as { model_id: string }[]).map(item => item.model_id); return json({ ids, userId: user.id }); }); }
export function favoritesPut(request: Request) { return handle(async () => {
  const user = requireUser(request); mutation(request, user); const body = await readJson(request); if (body.expectedUserId !== undefined && body.expectedUserId !== user.id) throw new ApiFailure(409, "Аккаунт изменился в другой вкладке. Обновите страницу перед сохранением избранного."); const known = new Set(models.map(model => model.id)); if (!Array.isArray(body.ids) || body.ids.length > 100 || body.ids.some(id => typeof id !== "string" || !known.has(id))) throw new ApiFailure(422, "Некорректный список избранного.", { ids: "Выберите модели из каталога." }); const ids = [...new Set(body.ids)] as string[];
  transaction(() => { const db = database(); db.prepare("DELETE FROM favorites WHERE user_id=?").run(user.id); const insert = db.prepare("INSERT INTO favorites(user_id,model_id) VALUES(?,?)"); for (const id of ids) insert.run(user.id, id); }); return json({ ids });
}); }
export function adminApplicationsGet(request: Request) { return handle(() => { requireAdmin(request); const query = new URL(request.url).searchParams; let applications = listApplications(); const status = query.get("status"); const type = query.get("type"); const search = (query.get("q") || "").trim().toLowerCase(); if (status) applications = applications.filter(item => item.status === status); if (type) applications = applications.filter(item => item.type === type); if (search) applications = applications.filter(item => `${item.name} ${item.email} ${item.reference} ${item.title}`.toLowerCase().includes(search)); return json({ applications }); }); }
export function adminApplicationPatch(request: Request, context: IdContext) { return handle(async () => {
  const admin = requireAdmin(request); mutation(request, admin); const { id } = await context.params; const body = await readJson(request); const status = body.status as ApplicationStatus; const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!APPLICATION_STATUSES.includes(status) || !["reviewing", "accepted", "rejected", "waiting"].includes(status)) throw new ApiFailure(422, "Выберите допустимый статус.", { status: "На рассмотрении, принята, отклонена или лист ожидания." }); if (note.length > 2000) throw new ApiFailure(422, "Примечание — не более 2000 символов.", { note: "Сократите примечание." }); return json({ application: reviewApplication(admin, id, status, note) });
}); }
export function adminUsersGet(request: Request) { return handle(() => { requireAdmin(request); const users = database().prepare("SELECT * FROM users ORDER BY created_at DESC").all() as unknown as Parameters<typeof publicUser>[0][]; return json({ users: users.map(publicUser) }); }); }
export function adminUserPatch(request: Request, context: IdContext) { return handle(async () => {
  const admin = requireAdmin(request); mutation(request, admin); const { id } = await context.params; const body = await readJson(request); if (body.role !== "member" && body.role !== "admin") throw new ApiFailure(422, "Некорректная роль."); const role = body.role;
  const user = transaction(() => { const row = userById(id); if (!row) throw new ApiFailure(404, "Пользователь не найден."); if (role === "member" && row.role === "admin") { const count = (database().prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get() as { n: number }).n; if (count <= 1) throw new ApiFailure(409, "Нельзя лишить прав последнего администратора."); if (id === admin.id) throw new ApiFailure(409, "Не изменяйте собственные административные права."); } database().prepare("UPDATE users SET role=? WHERE id=?").run(role, id); database().prepare("INSERT INTO audit_log(actor_id,action,target_id,at,details) VALUES(?,?,?,?,?)").run(admin.id, "user.role", id, new Date().toISOString(), role); return publicUser(userById(id)!); }); return json({ user });
}); }
export function healthGet() { return handle(() => { database().prepare("SELECT 1").get(); return json({ ok: true }); }); }
