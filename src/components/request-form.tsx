"use client";
import { useState, Suspense, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Alert, Button, Checkbox, FormControlLabel, MenuItem, TextField } from "@mui/material";
import { events, isEventAvailable, formatEventDate } from "@/data/events";
import { courses } from "@/data/courses";
import { models } from "@/data/models";
import { saveDemoRecord } from "@/lib/demo";
import { Arrow } from "@/components/site-shell";

function ApplicationForm({ contact = false }: { contact?: boolean }) {
  const query = useSearchParams();
  const initialEvent = events.find(e => e.id === query.get("event"));
  const initialCourse = courses.find(c => c.id === query.get("course"));
  const initialModel = models.find(m => m.id === query.get("model"));
  const viewer = query.get("role") === "viewer";
  const [selection, setSelection] = useState(initialCourse ? `course:${initialCourse.id}` : initialEvent ? `event:${initialEvent.id}` : "general");
  const [modelId, setModelId] = useState(initialModel?.id ?? "any");
  const [saved, setSaved] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const activeEvent = events.find(e => selection === `event:${e.id}`);
  const activeCourse = courses.find(c => selection === `course:${c.id}`);
  const eligibleEvents = events.filter(e => isEventAvailable(e) && (!viewer || (e.openToPublic && e.type === "Показ" && e.seats > 0)));
  const unavailable = viewer ? !activeEvent || !eligibleEvents.some(e => e.id === activeEvent.id) : !!activeEvent && !isEventAvailable(activeEvent);
  const badQuery = (query.has("event") && !initialEvent) || (query.has("course") && !initialCourse) || (query.has("model") && !initialModel);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (unavailable || badQuery || busy) return;
    const form = e.currentTarget; const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const city = String(data.get("city") || "").trim();
    const phoneDigits = String(data.get("phone") || "").replace(/\D/g, "");
    if (name.length < 2 || city.length < 2) { setError("Укажите имя и город: минимум 2 символа, кроме пробелов."); return; }
    if (phoneDigits.length < 7 || phoneDigits.length > 15) { setError("Укажите корректный телефон: от 7 до 15 цифр."); return; }
    if (contact && String(data.get("description") || "").trim().length < 10) { setError("Расскажите о проекте чуть подробнее: минимум 10 символов."); return; }
    if (!contact && !viewer && !activeCourse && files.length === 0) { setError("Добавьте хотя бы одну фотографию: портрет, профиль или полный рост."); return; }
    setError(""); setBusy(true);
    try {
      const title = contact ? (modelId === "any" ? "Запрос на подбор модели" : `Приглашение: ${models.find(m => m.id === modelId)?.name}`) : activeCourse?.title ?? activeEvent?.title ?? "Анкета новой модели";
      saveDemoRecord({ title, type: contact ? "Сотрудничество" : activeCourse ? "Обучение" : viewer ? "Зрительская запись" : "Кастинг", name, email: String(data.get("email")).trim() });
      setSaved(true);
    } catch { setError("Не удалось сохранить черновик. Проверьте, разрешено ли браузеру локальное хранилище, и повторите."); }
    finally { setBusy(false); }
  }
  if (saved) return <div className="form-success" role="status"><p className="eyebrow">СЛЕДУЮЩИЙ ШАГ СДЕЛАН</p><h2>Черновик сохранён.</h2><p>Он доступен в вашем демо-кабинете в этом браузере. Заявка не отправлена организатору: это прототип фронтенда, серверная обработка пока не подключена. Фотографии не загружаются и не сохраняются.</p><Link className="button button-dark" href="/account">Открыть кабинет <Arrow /></Link><Button onClick={() => { setFiles([]); setSaved(false); }} sx={{ ml: 1 }}>Вернуться к форме</Button></div>;
  return <form className="application-form" onSubmit={submit}>
    <div className="form-note">Демонстрационная форма. Сохранится только черновик с именем, email и выбранным проектом в этом браузере. Отправка и загрузка фотографий станут доступны после подключения сервера.</div>
    {badQuery && <Alert severity="warning">Указанный проект или модель не найдены. Вернитесь в каталог и выберите актуальную карточку.</Alert>}
    <p className="form-section-label">01 / {contact ? "ВАШ ПРОЕКТ" : "НАПРАВЛЕНИЕ"}</p>
    {contact ? <TextField select label="Кого вы ищете?" value={modelId} onChange={e => setModelId(e.target.value)}><MenuItem value="any">Помогите подобрать модель</MenuItem>{models.map(m => <MenuItem key={m.id} value={m.id}>{m.name} · {m.city}</MenuItem>)}</TextField> : <TextField select label={viewer ? "Запись зрителем на показ" : "Кастинг, событие или курс"} value={selection} onChange={e => { setSelection(e.target.value); setError(""); }}><MenuItem value="general" disabled={viewer}>Стать моделью · общая анкета</MenuItem>{eligibleEvents.map(e => <MenuItem key={e.id} value={`event:${e.id}`}>{e.title} · {formatEventDate(e.date)}</MenuItem>)}{activeEvent && !eligibleEvents.some(e => e.id === activeEvent.id) && <MenuItem value={`event:${activeEvent.id}`}>{activeEvent.title} · приём закрыт</MenuItem>}{!viewer && courses.map(c => <MenuItem key={c.id} value={`course:${c.id}`}>{c.title} · курс</MenuItem>)}</TextField>}
    {viewer && <Alert severity="info">Запись зрителем — посещение открытого показа. Она не является заявкой модели на участие.</Alert>}
    {unavailable && <Alert severity="warning">Приём заявок на это событие закрыт или зрительская запись недоступна. Выберите другое событие.</Alert>}
    <p className="form-section-label">02 / О ВАС</p>
    <div className="form-fields"><TextField name="name" label={contact ? "Имя / бренд" : "Имя и фамилия"} required slotProps={{ htmlInput: { minLength: 2, maxLength: 100 } }} autoComplete="name" /><TextField name="email" label="Email" type="email" autoComplete="email" required /><TextField name="city" label="Город" autoComplete="address-level2" required /><TextField name="phone" label="Телефон" type="tel" autoComplete="tel" slotProps={{ htmlInput: { pattern: "[+0-9() \\-]{7,20}", title: "От 7 до 20 символов: цифры, +, скобки и дефис" } }} required />
    {contact && <><TextField name="date" label="Планируемая дата" type="date" slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: "2026-10-30" } }} required /><TextField name="project" label="Формат проекта" select defaultValue="Editorial"><MenuItem value="Editorial">Editorial</MenuItem><MenuItem value="Показ">Показ</MenuItem><MenuItem value="Реклама">Рекламная кампания</MenuItem><MenuItem value="Другое">Другое</MenuItem></TextField></>}
    {!contact && !viewer && !activeCourse && <><TextField name="height" label="Рост, см" type="number" required slotProps={{ htmlInput: { min: 140, max: 220 } }} /><TextField name="measurements" label="Параметры, см" placeholder="Грудь / талия / бёдра" required slotProps={{ htmlInput: { maxLength: 40 } }} /></>}
    <TextField className="full" name="description" label={contact ? "Расскажите о проекте и условиях" : viewer ? "Комментарий (необязательно)" : activeCourse ? "Ваш опыт и цель обучения" : "Опыт и немного о себе"} multiline minRows={4} required={contact} slotProps={{ htmlInput: { maxLength: 2000 } }} />
    </div>
    {!contact && !viewer && !activeCourse && <><p className="form-section-label">03 / ФОТОГРАФИИ</p><label className="upload-field"><span>Портрет, профиль и полный рост</span><small>JPEG, PNG или WebP · до 5 МБ за файл · до 3 фото</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Добавить фотографии" onChange={e => { const chosen = Array.from(e.target.files ?? []); if (chosen.length > 3 || chosen.some(f => !["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size > 5 * 1024 * 1024)) { setFiles([]); e.target.value = ""; setError("Допустимы до 3 фотографий JPEG, PNG или WebP размером не более 5 МБ каждая."); } else { setFiles(chosen.map(f => f.name)); setError(""); } }} />{files.length > 0 && <small>Выбрано: {files.join(", ")}</small>}</label></>}
    <FormControlLabel control={<Checkbox required size="small" />} label={<span style={{ fontSize: 11, lineHeight: 1.6 }}>Я понимаю, что это демо, и согласен с сохранением черновика в этом браузере.</span>} />
    {error && <Alert severity="error">{error}</Alert>}
    <Button variant="contained" size="large" type="submit" disabled={busy || unavailable || !!badQuery} endIcon={<Arrow />} sx={{ justifyContent: "space-between" }}>{busy ? "Сохраняем…" : "Сохранить демо-заявку"}</Button>
  </form>;
}
function QueryForm({ contact }: { contact: boolean }) { const query = useSearchParams(); return <ApplicationForm key={query.toString()} contact={contact} />; }
export function RequestForm({ contact = false }: { contact?: boolean }) { return <Suspense fallback={<div style={{ minHeight: 420 }} aria-busy="true">Загружаем форму…</div>}><QueryForm contact={contact} /></Suspense>; }
export function FormImage({ contact = false }: { contact?: boolean }) { return <div className="form-aside-image"><Image src={contact ? "/images/editorial-01.jpg" : "/images/model-03.jpg"} alt={contact ? "Редакционная fashion-съёмка" : "Редакционный портрет новой модели"} fill sizes="(max-width:600px) 100vw, 35vw" /></div>; }
