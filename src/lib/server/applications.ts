import { randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { events, getToday, isEventAvailable, isViewerRegistrationAvailable } from "@/data/events";
import { courses, isCourseAvailable } from "@/data/courses";
import { models } from "@/data/models";
import type { Application, ApplicationHistoryEntry, ApplicationInput, ApplicationStatus, ApplicationType, Photo, User } from "@/types/api";
import { database, transaction, uploadsDirectory } from "./db";
import { ApiFailure, digest } from "./http";
import type { PreparedPhoto } from "./uploads";
import { applicationEditReason } from "@/lib/application-editing";
interface ApplicationRow { id: string; reference: string; user_id: string; type: ApplicationType; title: string; target_id: string | null; model_id: string | null; status: ApplicationStatus; name: string; email: string; phone: string; city: string; height: number | null; age: number | null; measurements: string; description: string; project_type: string; project_date: string; idempotency_key: string; dedupe_key: string; request_fingerprint: string; created_at: string; updated_at: string; admin_note: string; }
interface PhotoRow { id: string; application_id: string; file_name: string; original_name: string; size: number; content_type: string; }
function toApplication(row: ApplicationRow): Application {
  const db = database();
  const photos = (db.prepare("SELECT * FROM photos WHERE application_id=? ORDER BY rowid").all(row.id) as unknown as PhotoRow[]).map((photo): Photo => ({ id: photo.id, url: `/api/uploads/${photo.id}`, name: photo.original_name, size: photo.size, type: photo.content_type }));
  const history = (db.prepare("SELECT status,at,note FROM application_history WHERE application_id=? ORDER BY id").all(row.id) as unknown as ApplicationHistoryEntry[]);
  return { id: row.id, reference: row.reference, userId: row.user_id, type: row.type, title: row.title, targetId: row.target_id, modelId: row.model_id, status: row.status, name: row.name, email: row.email, phone: row.phone, city: row.city, height: row.height, age: row.age, measurements: row.measurements, description: row.description, projectType: row.project_type, projectDate: row.project_date, createdAt: row.created_at, updatedAt: row.updated_at, adminNote: row.admin_note, photos, history };
}
export function applicationById(id: string) { const row = database().prepare("SELECT * FROM applications WHERE id=?").get(id) as unknown as ApplicationRow | undefined; return row ? toApplication(row) : null; }
export function listApplications(userId?: string) { const db = database(); const rows = userId ? db.prepare("SELECT * FROM applications WHERE user_id=? ORDER BY created_at DESC,rowid DESC").all(userId) : db.prepare("SELECT * FROM applications ORDER BY created_at DESC,rowid DESC").all(); return (rows as unknown as ApplicationRow[]).map(toApplication); }
function rememberApplication(userId: string, type: ApplicationType, id: string) {
  database().prepare("INSERT INTO application_templates(user_id,type,application_id) VALUES(?,?,?) ON CONFLICT(user_id,type) DO UPDATE SET application_id=excluded.application_id").run(userId, type, id);
}
export function applicationTemplate(userId: string, type: ApplicationType) {
  const db = database();
  const saved = db.prepare(`SELECT applications.* FROM application_templates
    JOIN applications ON applications.id=application_templates.application_id
    WHERE application_templates.user_id=? AND application_templates.type=?
      AND applications.user_id=? AND applications.type=application_templates.type`).get(userId, type, userId) as unknown as ApplicationRow | undefined;
  // Existing accounts can reuse applications submitted before templates existed.
  const row = saved ?? db.prepare("SELECT * FROM applications WHERE user_id=? AND type=? ORDER BY updated_at DESC,created_at DESC,rowid DESC LIMIT 1").get(userId, type) as unknown as ApplicationRow | undefined;
  return row ? toApplication(row) : null;
}
function nextTimestamp(previous: string) {
  const time = Date.parse(previous);
  return new Date(Math.max(Date.now(), Number.isFinite(time) ? time + 1 : 0)).toISOString();
}
export function idempotentApplication(userId: string, key: string, fingerprint?: string) { const row = database().prepare("SELECT * FROM applications WHERE user_id=? AND idempotency_key=?").get(userId, key) as unknown as ApplicationRow | undefined; if (row && fingerprint !== undefined && row.request_fingerprint !== fingerprint) throw new ApiFailure(409, "Идентификатор отправки уже использован для другой заявки. Обновите форму."); return row ? toApplication(row) : null; }
export function validateApplicationTarget(input: ApplicationInput) {
  const today = getToday();
  if (input.type === "course") {
    const course = courses.find(item => item.id === input.targetId);
    if (!course) throw new ApiFailure(422, "Курс не найден.", { targetId: "Выберите существующий курс." });
    if (!isCourseAvailable(course, today)) throw new ApiFailure(422, "Запись на этот курс закрыта.", { targetId: "Курс уже начался. Выберите другую программу." });
    if (input.modelId) throw new ApiFailure(422, "Модель не связана с записью на курс.");
    return course.title;
  }
  if (input.type === "collaboration") {
    if (input.targetId) throw new ApiFailure(422, "Для сотрудничества выберите модель, а не событие.");
    const model = input.modelId ? models.find(item => item.id === input.modelId) : null;
    if (input.modelId && !model) throw new ApiFailure(422, "Модель не найдена.", { modelId: "Выберите существующую модель." });
    if (input.projectDate < today) throw new ApiFailure(422, "Дата проекта уже прошла.", { projectDate: "Выберите сегодняшнюю или будущую дату." });
    return model ? `Приглашение: ${model.name}` : "Подбор модели";
  }
  if (input.modelId) throw new ApiFailure(422, "Выбранная модель доступна только в запросе на сотрудничество.");
  if (input.type === "model" && !input.targetId) return "Анкета новой модели";
  const event = events.find(item => item.id === input.targetId);
  if (!event) throw new ApiFailure(422, "Событие не найдено.", { targetId: "Выберите существующее событие." });
  if (!isEventAvailable(event)) throw new ApiFailure(422, "Приём заявок на событие закрыт.", { targetId: "Событие прошло, отменено или срок подачи заявки истёк." });
  if (input.type === "viewer" && !isViewerRegistrationAvailable(event, today)) throw new ApiFailure(422, "Зрительская запись недоступна.", { targetId: "Запись зрителем возможна только на открытый показ." });
  return event.title;
}
function dedupeKey(input: ApplicationInput) { return input.type === "collaboration" ? `collaboration:${digest(JSON.stringify({ model: input.modelId, date: input.projectDate, city: input.city.toLocaleLowerCase("ru").trim(), format: input.projectType, brief: input.description.replace(/\s+/g, " ").trim() }))}` : `${input.type}:${input.targetId || "general"}`; }
const reservedStatuses = "'submitted','reviewing','accepted'";
function occupiedSeats(targetId: string, exceptId = "") { return (database().prepare(`SELECT COUNT(*) AS n FROM applications WHERE type='viewer' AND target_id=? AND id<>? AND status IN (${reservedStatuses})`).get(targetId, exceptId) as { n: number }).n; }
export function createApplication(user: User, input: ApplicationInput, photos: PreparedPhoto[], fingerprint: string) {
  const written: string[] = [];
  try {
    return transaction(() => {
      const db = database(); const previous = idempotentApplication(user.id, input.idempotencyKey, fingerprint);
      if (previous) return { application: previous, repeated: true };
      const duplicate = db.prepare("SELECT id FROM applications WHERE user_id=? AND dedupe_key=? AND status IN ('submitted','reviewing','accepted','waiting')").get(user.id, dedupeKey(input));
      if (duplicate) throw new ApiFailure(409, "У вас уже есть активная заявка на этот проект. Посмотрите её в личном кабинете.");
      const title = validateApplicationTarget(input); let status: ApplicationStatus = "submitted";
      if (input.type === "viewer") { const event = events.find(item => item.id === input.targetId)!; if (occupiedSeats(event.id) >= event.seats) status = "waiting"; }
      const id = randomUUID(); const at = new Date().toISOString(); const reference = `RW-${getToday().replaceAll("-", "")}-${id.slice(0, 8).toUpperCase()}`;
      db.prepare(`INSERT INTO applications(id,reference,user_id,type,title,target_id,model_id,status,name,email,phone,city,height,age,measurements,description,project_type,project_date,idempotency_key,dedupe_key,request_fingerprint,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, reference, user.id, input.type, title, input.targetId, input.modelId, status, input.name, input.email, input.phone, input.city, input.height, input.age, input.measurements, input.description, input.projectType, input.projectDate, input.idempotencyKey, dedupeKey(input), fingerprint, at, at);
      for (const photo of photos) { const photoId = randomUUID(); const fileName = `${photoId}.jpg`; const destination = path.join(uploadsDirectory(), fileName); writeFileSync(destination, photo.data, { flag: "wx", mode: 0o600 }); written.push(destination); db.prepare("INSERT INTO photos(id,application_id,file_name,original_name,size,content_type) VALUES(?,?,?,?,?,?)").run(photoId, id, fileName, photo.name, photo.data.length, photo.type); }
      db.prepare("INSERT INTO application_history(application_id,status,at,note,actor_id) VALUES(?,?,?,?,?)").run(id, status, at, status === "waiting" ? "Свободные места закончились: заявка добавлена в лист ожидания." : "Заявка сохранена на сервере.", user.id);
      rememberApplication(user.id, input.type, id);
      return { application: applicationById(id)!, repeated: false };
    });
  } catch (error) { for (const file of written) { try { unlinkSync(file); } catch { /* retained private orphan if filesystem temporarily unavailable */ } } throw error; }
}
export function editApplication(user: User, id: string, expectedUpdatedAt: string, input: ApplicationInput, retainedPhotoIds: string[] | undefined, photos: PreparedPhoto[]) {
  const written: string[] = [];
  const removedFiles: string[] = [];
  let result: Application;
  try {
    result = transaction(() => {
      const db = database();
      const current = applicationById(id);
      if (!current || current.userId !== user.id) throw new ApiFailure(404, "Заявка не найдена.");
      if (!expectedUpdatedAt || current.updatedAt !== expectedUpdatedAt) throw new ApiFailure(409, "Заявка уже изменилась. Обновите данные перед редактированием.");
      const unavailable = applicationEditReason(current);
      if (unavailable) throw new ApiFailure(409, unavailable);
      if (input.type !== current.type || input.targetId !== current.targetId || input.modelId !== current.modelId) throw new ApiFailure(422, "Тип и выбранный проект отправленной заявки изменить нельзя.");
      const account = db.prepare("SELECT email FROM users WHERE id=?").get(user.id) as { email: string } | undefined;
      if (!account || account.email !== user.email || input.email !== user.email) throw new ApiFailure(409, "Email аккаунта изменился. Обновите страницу и повторите сохранение.");
      const retained = retainedPhotoIds ?? current.photos.map(photo => photo.id);
      if (retained.some(photoId => !current.photos.some(photo => photo.id === photoId))) throw new ApiFailure(422, "Сохранить можно только фотографии этой заявки.", { photos: "Обновите список фотографий заявки." });
      const count = retained.length + photos.length;
      if (count > 3 || (current.type === "model" && count < 1)) throw new ApiFailure(422, "Укажите от 1 до 3 фотографий для анкеты модели.", { photos: current.type === "model" ? "Оставьте хотя бы одну фотографию. Всего — до 3." : "Всего — до 3 фотографий." });
      const duplicate = db.prepare("SELECT id FROM applications WHERE user_id=? AND dedupe_key=? AND id<>? AND status IN ('submitted','reviewing','accepted','waiting')").get(user.id, dedupeKey(input), id);
      if (duplicate) throw new ApiFailure(409, "У вас уже есть другая активная заявка на этот проект.");
      validateApplicationTarget(input);
      let status: ApplicationStatus = "submitted";
      if (current.type === "viewer") {
        const event = events.find(item => item.id === current.targetId)!;
        if (occupiedSeats(event.id, id) >= event.seats) status = "waiting";
      }
      const at = nextTimestamp(current.updatedAt);
      db.prepare(`UPDATE applications SET name=?,email=?,phone=?,city=?,height=?,age=?,measurements=?,description=?,project_type=?,project_date=?,dedupe_key=?,status=?,updated_at=?,admin_note='' WHERE id=?`).run(
        input.name, user.email, input.phone, input.city, input.height, input.age, input.measurements, input.description, input.projectType, input.projectDate, dedupeKey(input), status, at, id,
      );
      const previousPhotos = db.prepare("SELECT * FROM photos WHERE application_id=?").all(id) as unknown as PhotoRow[];
      for (const photo of previousPhotos) {
        if (retained.includes(photo.id)) continue;
        db.prepare("DELETE FROM photos WHERE id=? AND application_id=?").run(photo.id, id);
        if (/^[a-f0-9-]{36}\.jpg$/.test(photo.file_name)) removedFiles.push(path.join(uploadsDirectory(), photo.file_name));
      }
      for (const photo of photos) {
        const photoId = randomUUID(); const fileName = `${photoId}.jpg`; const destination = path.join(uploadsDirectory(), fileName);
        writeFileSync(destination, photo.data, { flag: "wx", mode: 0o600 }); written.push(destination);
        db.prepare("INSERT INTO photos(id,application_id,file_name,original_name,size,content_type) VALUES(?,?,?,?,?,?)").run(photoId, id, fileName, photo.name, photo.data.length, photo.type);
      }
      const note = status === "waiting" ? "Автор обновил заявку. Свободных зрительских мест нет: лист ожидания." : "Автор обновил заявку. Данные отправлены на повторное рассмотрение.";
      db.prepare("INSERT INTO application_history(application_id,status,at,note,actor_id) VALUES(?,?,?,?,?)").run(id, status, at, note, user.id);
      db.prepare("INSERT INTO audit_log(actor_id,action,target_id,at,details) VALUES(?,?,?,?,?)").run(user.id, "application.edit", id, at, JSON.stringify({ status, retainedPhotos: retained.length, addedPhotos: photos.length }));
      rememberApplication(user.id, current.type, id);
      return applicationById(id)!;
    });
  } catch (error) {
    for (const file of written) { try { unlinkSync(file); } catch { /* Private orphan can be cleaned during maintenance. */ } }
    throw error;
  }
  // New applications copy file bytes into their own private files, so an old
  // application's removed image can be deleted without damaging another one.
  for (const file of removedFiles) { try { unlinkSync(file); } catch { /* Metadata already prevents access to the private orphan. */ } }
  return result;
}
export function withdrawApplication(user: User, id: string) {
  return transaction(() => { const application = applicationById(id); if (!application || application.userId !== user.id) throw new ApiFailure(404, "Заявка не найдена."); if (application.status === "withdrawn") return application; const at = nextTimestamp(application.updatedAt); database().prepare("UPDATE applications SET status='withdrawn',updated_at=? WHERE id=?").run(at, id); database().prepare("INSERT INTO application_history(application_id,status,at,note,actor_id) VALUES(?,?,?,?,?)").run(id, "withdrawn", at, "Заявка отозвана пользователем.", user.id); return applicationById(id)!; });
}
export function reviewApplication(admin: User, id: string, status: ApplicationStatus, note: string, expectedUpdatedAt: string) {
  return transaction(() => { const application = applicationById(id); if (!application) throw new ApiFailure(404, "Заявка не найдена.");
    if (!expectedUpdatedAt || application.updatedAt !== expectedUpdatedAt) throw new ApiFailure(409, "Заявка изменилась после открытия. Обновите анкету перед рассмотрением.");
    if (application.status === "withdrawn") throw new ApiFailure(409, "Отозванную заявку нельзя изменять.");
    if (application.type === "viewer" && ["submitted", "reviewing", "accepted"].includes(status)) { const event = events.find(item => item.id === application.targetId); if (!event || occupiedSeats(event.id, id) >= event.seats) throw new ApiFailure(409, "Свободных зрительских мест нет. Используйте лист ожидания."); }
    if (["submitted", "reviewing", "accepted", "waiting"].includes(status)) { const current = database().prepare("SELECT dedupe_key FROM applications WHERE id=?").get(id) as { dedupe_key: string }; const duplicate = database().prepare("SELECT id FROM applications WHERE user_id=? AND dedupe_key=? AND id<>? AND status IN ('submitted','reviewing','accepted','waiting')").get(application.userId, current.dedupe_key, id); if (duplicate) throw new ApiFailure(409, "У пользователя уже есть другая активная заявка на этот проект."); }
    const at = nextTimestamp(application.updatedAt); database().prepare("UPDATE applications SET status=?,updated_at=?,admin_note=? WHERE id=?").run(status, at, note, id); database().prepare("INSERT INTO application_history(application_id,status,at,note,actor_id) VALUES(?,?,?,?,?)").run(id, status, at, note, admin.id); database().prepare("INSERT INTO audit_log(actor_id,action,target_id,at,details) VALUES(?,?,?,?,?)").run(admin.id, "application.review", id, at, JSON.stringify({ status, note })); return applicationById(id)!;
  });
}
export function privatePhoto(id: string) { return database().prepare("SELECT photos.*,applications.user_id FROM photos JOIN applications ON applications.id=photos.application_id WHERE photos.id=?").get(id) as unknown as (PhotoRow & { user_id: string }) | undefined; }
