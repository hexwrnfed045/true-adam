import type { ApplicationInput, ApplicationStatus, ApplicationType, LoginInput, PasswordInput, ProfileInput, RegisterInput } from "@/types/api";
export const APPLICATION_TYPES: ApplicationType[] = ["model", "viewer", "course", "collaboration"];
export const APPLICATION_STATUSES: ApplicationStatus[] = ["submitted", "reviewing", "accepted", "rejected", "withdrawn", "waiting"];
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = { submitted: "Отправлена", reviewing: "На рассмотрении", accepted: "Принята", rejected: "Отклонена", withdrawn: "Отозвана", waiting: "Лист ожидания" };
export const APPLICATION_TYPE_LABELS: Record<ApplicationType, string> = { model: "Заявка модели", viewer: "Зрительская запись", course: "Обучение", collaboration: "Сотрудничество" };
export const PROJECT_TYPES = ["Editorial", "Показ", "Реклама", "Другое"];
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MIN_PASSWORD_LENGTH = 8;
export interface ValidationResult<T> { value: T | null; fieldErrors: Record<string, string>; }
const str = (input: Record<string, unknown>, key: string) => typeof input[key] === "string" ? (input[key] as string).trim() : "";
export function normalizeEmail(value: string) { return value.trim().toLowerCase(); }
export function isValidEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function isValidDate(value: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const d = new Date(`${value}T12:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value; }
export function validatePassword(value: string) { return value.length >= MIN_PASSWORD_LENGTH && value.length <= 128; }
function result<T>(value: T, fieldErrors: Record<string, string>): ValidationResult<T> { return { value: Object.keys(fieldErrors).length ? null : value, fieldErrors }; }
function identity(input: Record<string, unknown>, errors: Record<string, string>) { const name = str(input, "name"); const city = str(input, "city"); if (name.length < 2 || name.length > 100) errors.name = "Введите имя: от 2 до 100 символов."; if (city.length < 2 || city.length > 80) errors.city = "Введите город: от 2 до 80 символов."; return { name, city }; }
export function validateRegister(input: Record<string, unknown>): ValidationResult<RegisterInput> {
  const errors: Record<string, string> = {}; const who = identity(input, errors); const email = normalizeEmail(str(input, "email")); const password = typeof input.password === "string" ? input.password : ""; const consent = input.consent === true;
  if (!isValidEmail(email)) errors.email = "Введите корректный email."; if (!validatePassword(password)) errors.password = "Пароль должен содержать от 8 до 128 символов."; if (!consent) errors.consent = "Необходимо согласие на обработку данных.";
  return result({ ...who, email, password, consent }, errors);
}
export function validateLogin(input: Record<string, unknown>): ValidationResult<LoginInput> { const errors: Record<string, string> = {}; const email = normalizeEmail(str(input, "email")); const password = typeof input.password === "string" ? input.password : ""; if (!isValidEmail(email)) errors.email = "Введите корректный email."; if (!password || password.length > 128) errors.password = "Введите пароль."; return result({ email, password }, errors); }
export function validateProfile(input: Record<string, unknown>): ValidationResult<ProfileInput> { const errors: Record<string, string> = {}; return result(identity(input, errors), errors); }
export function validatePasswordChange(input: Record<string, unknown>): ValidationResult<PasswordInput> { const errors: Record<string, string> = {}; const currentPassword = typeof input.currentPassword === "string" ? input.currentPassword : ""; const newPassword = typeof input.newPassword === "string" ? input.newPassword : ""; if (!currentPassword || currentPassword.length > 128) errors.currentPassword = "Введите текущий пароль."; if (!validatePassword(newPassword)) errors.newPassword = "Новый пароль должен содержать от 8 до 128 символов."; if (newPassword === currentPassword && newPassword) errors.newPassword = "Новый пароль должен отличаться от текущего."; return result({ currentPassword, newPassword }, errors); }
export function validateApplicationFields(input: Record<string, unknown>): ValidationResult<ApplicationInput> {
  const errors: Record<string, string> = {}; const who = identity(input, errors); const type = str(input, "type") as ApplicationType; const email = normalizeEmail(str(input, "email")); const phone = str(input, "phone"); const targetId = str(input, "targetId") || null; const modelId = str(input, "modelId") || null;
  const ageText = str(input, "age"); const age = ageText ? Number(ageText) : null; const heightText = str(input, "height"); const height = heightText ? Number(heightText) : null; const measurements = str(input, "measurements"); const description = str(input, "description"); const projectType = str(input, "projectType"); const projectDate = str(input, "projectDate"); const consent = input.consent === true || input.consent === "true"; const idempotencyKey = str(input, "idempotencyKey");
  if (!APPLICATION_TYPES.includes(type)) errors.type = "Выберите тип заявки."; if (!isValidEmail(email)) errors.email = "Введите корректный email.";
  const digits = phone.replace(/\D/g, ""); if (digits.length < 7 || digits.length > 15 || !/^[+\d()\s-]+$/.test(phone) || phone.length > 30) errors.phone = "Укажите телефон: от 7 до 15 цифр.";
  if (targetId && (targetId.length > 100 || !/^[a-z0-9-]+$/.test(targetId))) errors.targetId = "Некорректный проект."; if (modelId && (modelId.length > 100 || !/^[a-z0-9-]+$/.test(modelId))) errors.modelId = "Некорректная модель.";
  if (type === "model") { if (age === null || !Number.isInteger(age) || age < 18 || age > 80) errors.age = "Возраст модели — от 18 до 80 лет."; if (height === null || !Number.isFinite(height) || !Number.isInteger(height) || height < 140 || height > 220) errors.height = "Укажите рост от 140 до 220 см."; if (!/^\d{2,3}\s*[/,\-]\s*\d{2,3}\s*[/,\-]\s*\d{2,3}$/.test(measurements) || measurements.length > 40 || (measurements.match(/\d+/g) || []).some(n => Number(n) < 40 || Number(n) > 180)) errors.measurements = "Укажите грудь / талию / бёдра в сантиметрах."; }
  if (age !== null && (!Number.isInteger(age) || age < 18 || age > 80)) errors.age = "Возраст — от 18 до 80 лет.";
  if (height !== null && (!Number.isFinite(height) || height < 140 || height > 220)) errors.height = "Некорректный рост.";
  if (description.length > 2000) errors.description = "Описание — не более 2000 символов.";
  if (type === "collaboration") { if (description.length < 10) errors.description = "Опишите проект: минимум 10 символов."; if (!PROJECT_TYPES.includes(projectType)) errors.projectType = "Выберите формат проекта."; if (!isValidDate(projectDate)) errors.projectDate = "Укажите корректную дату проекта."; }
  if (measurements.length > 40) errors.measurements = "Параметры — не более 40 символов."; if (projectType.length > 80) errors.projectType = "Слишком длинный формат проекта."; if (projectDate && !isValidDate(projectDate)) errors.projectDate = "Некорректная дата.";
  if (!consent) errors.consent = "Необходимо согласие на обработку данных."; if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) errors.idempotencyKey = "Обновите форму и повторите отправку.";
  return result({ ...who, type, email, phone, targetId, modelId, height, age, measurements, description, projectType, projectDate, consent, idempotencyKey }, errors);
}
