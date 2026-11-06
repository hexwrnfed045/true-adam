import { createHash } from "node:crypto";
import type { ApplicationInput } from "@/types/api";
import sharp from "sharp";
import { MAX_PHOTOS, MAX_PHOTO_BYTES, MAX_UPLOAD_BYTES } from "@/lib/validation";
import { ApiFailure, limitedBody } from "./http";
export interface PreparedPhoto { name: string; data: Buffer; type: "image/jpeg"; }
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

export async function applicationFingerprint(input: ApplicationInput, form: FormData) {
  const entries = form.getAll("photos");
  if (entries.length > MAX_PHOTOS) throw new ApiFailure(422, "Добавьте не более 3 фотографий.", { photos: "До 3 фотографий." });
  const photos: { name: string; type: string; size: number; hash: string }[] = [];
  for (const entry of entries) {
    if (typeof entry === "string" || entry.size > MAX_PHOTO_BYTES) throw new ApiFailure(422, "Недопустимая фотография.", { photos: "Загрузите фотографию до 5 МБ." });
    photos.push({ name: entry.name, type: entry.type, size: entry.size, hash: createHash("sha256").update(new Uint8Array(await entry.arrayBuffer())).digest("hex") });
  }
  return createHash("sha256").update(JSON.stringify({ fields: input, photos })).digest("hex");
}
