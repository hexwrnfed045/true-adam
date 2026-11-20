import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { ApplicationInput } from "@/types/api";
import sharp from "sharp";
import { MAX_PHOTOS, MAX_PHOTO_BYTES, MAX_UPLOAD_BYTES } from "@/lib/validation";
import { ApiFailure, limitedBody } from "./http";
import { database, uploadsDirectory } from "./db";
export interface PreparedPhoto { name: string; data: Buffer; type: "image/jpeg"; }
export function readPhotoIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  let ids: unknown = value;
  if (typeof value === "string") {
    try { ids = JSON.parse(value); }
    catch { throw new ApiFailure(422, "Некорректный список фотографий.", { photos: "Обновите сохранённые фотографии." }); }
  }
  if (!Array.isArray(ids) || ids.length > MAX_PHOTOS || ids.some(id => typeof id !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) || new Set(ids).size !== ids.length) {
    throw new ApiFailure(422, "Некорректный список фотографий.", { photos: "Выберите до 3 разных сохранённых фотографий." });
  }
  return ids as string[];
}
export function assertPhotoCount(count: number, required: boolean) {
  if (count > MAX_PHOTOS || (required && count === 0)) throw new ApiFailure(422, required ? "Добавьте от 1 до 3 фотографий." : "Добавьте не более 3 фотографий.", { photos: required ? "Оставьте хотя бы одно фото. Всего — до 3 фотографий." : "Всего — до 3 фотографий." });
}
export function prepareSavedPhotos(userId: string, ids: string[]): PreparedPhoto[] {
  return ids.map(id => {
    const photo = database().prepare(`SELECT photos.* FROM photos JOIN applications ON applications.id=photos.application_id WHERE photos.id=? AND applications.user_id=?`).get(id, userId) as { id: string; file_name: string; original_name: string; content_type: string } | undefined;
    if (!photo || photo.file_name !== `${photo.id}.jpg` || photo.content_type !== "image/jpeg") throw new ApiFailure(404, "Сохранённая фотография не найдена.", { photos: "Обновите список сохранённых фотографий." });
    try {
      const filename = path.join(uploadsDirectory(), photo.file_name);
      const size = statSync(filename).size;
      if (!size || size > MAX_PHOTO_BYTES) throw new Error("Invalid saved image size");
      const data = readFileSync(filename);
      if (!data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) throw new Error("Invalid saved image");
      return { name: photo.original_name, data, type: "image/jpeg" };
    } catch { throw new ApiFailure(404, "Сохранённая фотография недоступна.", { photos: "Выберите другое сохранённое фото или загрузите новое." }); }
  });
}
export async function readMultipart(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) throw new ApiFailure(415, "Ожидается форма с файлами.");
  const bytes = await limitedBody(request, MAX_UPLOAD_BYTES + 128 * 1024);
  try { return await new Response(bytes, { headers: { "Content-Type": contentType } }).formData(); }
  catch { throw new ApiFailure(400, "Не удалось прочитать форму. Повторите отправку."); }
}
export async function preparePhotos(form: FormData, required: boolean): Promise<PreparedPhoto[]> {
  const entries = form.getAll("photos");
  if (entries.length > MAX_PHOTOS || (required && entries.length === 0)) throw new ApiFailure(422, "Добавьте от 1 до 3 фотографий.", { photos: "Портрет, профиль и полный рост: до 3 фотографий." });
  const result: PreparedPhoto[] = []; let total = 0;
  for (const entry of entries) {
    if (typeof entry === "string" || !["image/jpeg", "image/png", "image/webp"].includes(entry.type) || entry.size === 0 || entry.size > MAX_PHOTO_BYTES) throw new ApiFailure(422, "Недопустимый файл.", { photos: "Допустимы JPEG, PNG и WebP размером до 5 МБ за файл." });
    total += entry.size; if (total > MAX_UPLOAD_BYTES) throw new ApiFailure(413, "Общий размер фотографий — не более 15 МБ.");
    try {
      const bytes = Buffer.from(await entry.arrayBuffer());
      const expected = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[entry.type];
      const actual = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? "jpeg" : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "png" : bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" ? "webp" : "";
      if (actual !== expected) throw new Error("Image signature mismatch");
      const image = sharp(bytes, { limitInputPixels: 20_000_000, failOn: "warning" });
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height || metadata.format !== expected || (metadata.pages || 1) > 1) throw new Error("Unsupported image");
      // Decoding, auto-orientation and re-encoding discard EXIF and embedded payloads.
      const data = await image.rotate().resize({ width: 2400, height: 3000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      if (data.length > MAX_PHOTO_BYTES) throw new Error("Processed image too large");
      const name = entry.name.replaceAll("\\", "/").split("/").pop()!.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 150) || "photo.jpg";
      result.push({ name, data, type: "image/jpeg" });
    } catch { throw new ApiFailure(422, "Фотография повреждена или не поддерживается.", { photos: "Загрузите обычное изображение JPEG, PNG или WebP до 5 МБ и 20 мегапикселей." }); }
  }
  return result;
}

export async function applicationFingerprint(input: ApplicationInput, form: FormData, savedPhotoIds: string[] = []) {
  const entries = form.getAll("photos");
  if (entries.length > MAX_PHOTOS) throw new ApiFailure(422, "Добавьте не более 3 фотографий.", { photos: "До 3 фотографий." });
  const photos: { name: string; type: string; size: number; hash: string }[] = [];
  for (const entry of entries) {
    if (typeof entry === "string" || entry.size > MAX_PHOTO_BYTES) throw new ApiFailure(422, "Недопустимая фотография.", { photos: "Загрузите фотографию до 5 МБ." });
    photos.push({ name: entry.name, type: entry.type, size: entry.size, hash: createHash("sha256").update(new Uint8Array(await entry.arrayBuffer())).digest("hex") });
  }
  // Photo IDs identify immutable, sanitized source files. Keeping IDs in the
  // request fingerprint lets retries return their independent copied record
  // even after the original photo has subsequently been removed by its owner.
  return createHash("sha256").update(JSON.stringify({ fields: input, photos, ...(savedPhotoIds.length ? { savedPhotoIds } : {}) })).digest("hex");
}
