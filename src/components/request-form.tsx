'use client';
import { Suspense, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Alert, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Skeleton, TextField } from '@mui/material';
import { events, formatEventDate, getToday, isEventAvailable, isViewerRegistrationAvailable } from '@/data/events';
import { courses, isCourseAvailable } from '@/data/courses';
import { models } from '@/data/models';
import type { Application, ApplicationType, User } from '@/types/api';
import { api, ApiError, jsonRequest } from '@/lib/client-api';
import { useSession } from './session-provider';
import { Arrow } from './site-shell';
import './forms.css';

const photoTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxPhotoBytes = 5 * 1024 * 1024;
function PhotoPreview({ file, remove }: { file: File; remove: () => void }) {
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <li className="photo-preview"><Image unoptimized src={url} width={110} height={140} alt={`Выбранная фотография: ${file.name}`} /><div><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} МБ</small></div><IconButton onClick={remove} size="small" aria-label={`Удалить ${file.name}`}>×</IconButton></li>;
}
function FormSkeleton() { return <div className="form-skeleton" aria-busy="true" aria-label="Загрузка формы"><Skeleton height={54} /><Skeleton height={80} /><Skeleton height={80} /><Skeleton height={150} /></div>; }

function ApplicationForm({ contact }: { contact: boolean }) {
  const query = useSearchParams();
  const { user, loading, error: sessionError, refresh, acceptUser } = useSession();
  const initialEvent = events.find(item => item.id === query.get('event'));
  const initialCourse = courses.find(item => item.id === query.get('course'));
  const initialModel = models.find(item => item.id === query.get('model'));
  const viewer = query.get('role') === 'viewer';
  const [selection, setSelection] = useState(initialCourse ? `course:${initialCourse.id}` : initialEvent ? `event:${initialEvent.id}` : 'general');
  const [modelId, setModelId] = useState(initialModel?.id || 'any');
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [readingPhotos, setReadingPhotos] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<Application | null>(null);
  const [reauth, setReauth] = useState(false);
  const [reauthBusy, setReauthBusy] = useState(false);
  const [reauthError, setReauthError] = useState('');
  const sending = useRef(false);
  const idempotencyKey = useRef<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const today = getToday();
  const activeEvent = contact ? undefined : events.find(item => selection === `event:${item.id}`);
  const activeCourse = contact ? undefined : courses.find(item => selection === `course:${item.id}`);
  const type: ApplicationType = contact ? 'collaboration' : viewer ? 'viewer' : activeCourse ? 'course' : 'model';
  const eligibleEvents = events.filter(item => viewer ? isViewerRegistrationAvailable(item, today) : isEventAvailable(item, today));
  const eligibleCourses = courses.filter(item => isCourseAvailable(item, today));
  const invalidReference = contact ? !!query.get('model') && !initialModel : (!!query.get('event') && !initialEvent) || (!!query.get('course') && !initialCourse) || (!!query.get('event') && !!query.get('course'));
  const unavailable = type === 'viewer' ? !activeEvent || !isViewerRegistrationAvailable(activeEvent, today) : !!activeEvent && !isEventAvailable(activeEvent, today) || !!activeCourse && !isCourseAvailable(activeCourse, today);
  const next = `${contact ? '/contact' : '/casting'}${query.toString() ? `?${query.toString()}` : ''}`;
  useEffect(() => {
    if (!dirty || receipt) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, receipt]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const field = (name: string) => ({ error: !!fieldErrors[name], helperText: fieldErrors[name] });

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = '';
    if (!files.length) return;
    setReadingPhotos(true);
    try {
      const unique = files.filter(file => !photos.some(old => old.name === file.name && old.size === file.size && old.lastModified === file.lastModified));
      if (photos.length + unique.length > 3) throw new Error('Можно добавить до 3 фотографий. Сначала удалите лишнюю.');
      for (const file of unique) {
        if (!photoTypes.includes(file.type)) throw new Error(`«${file.name}»: выберите JPEG, PNG или WebP.`);
        if (!file.size || file.size > maxPhotoBytes) throw new Error(`«${file.name}»: размер должен быть от 1 байта до 5 МБ.`);
        try { const bitmap = await createImageBitmap(file); const pixels = bitmap.width * bitmap.height; bitmap.close(); if (pixels > 20000000) throw new Error('resolution'); }
        catch { throw new Error(`«${file.name}»: изображение повреждено или слишком большого разрешения.`); }
      }
      setPhotos(old => [...old, ...unique]);
      setDirty(true);
      setError('');
      setFieldErrors(old => ({ ...old, photos: '' }));
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Не удалось прочитать фотографию.'); }
    finally { setReadingPhotos(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || unavailable || invalidReference || sending.current || readingPhotos) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const errors: Record<string, string> = {};
    for (const name of ['name', 'city']) if (String(data.get(name) || '').trim().length < 2) errors[name] = 'Минимум 2 символа, кроме пробелов.';
    const phone = String(data.get('phone') || '').replace(/\D/g, '');
    if (phone.length < 7 || phone.length > 15) errors.phone = 'Укажите от 7 до 15 цифр.';
    if (type === 'model') {
      const age = Number(data.get('age'));
      if (!Number.isInteger(age) || age < 18 || age > 80) errors.age = 'Анкеты принимаются от 18 до 80 лет.';
      if (!photos.length) errors.photos = 'Добавьте хотя бы одну фотографию.';
      const measurements = ['chest', 'waist', 'hips'].map(name => Number(data.get(name)));
      if (measurements.some(value => !Number.isFinite(value) || value < 40 || value > 180)) errors.measurements = 'Каждый параметр: от 40 до 180 см.';
      data.set('measurements', measurements.join('/'));
    }
    if (type === 'collaboration' && String(data.get('description') || '').trim().length < 10) errors.description = 'Опишите проект: минимум 10 символов.';
    if (Object.keys(errors).length) { setFieldErrors(errors); setError('Проверьте отмеченные поля. Данные пока не отправлены.'); return; }
    sending.current = true;
    setBusy(true);
    setFieldErrors({});
    setError('');
    idempotencyKey.current ||= crypto.randomUUID();
    data.set('type', type);
    data.set('targetId', contact ? '' : activeCourse?.id || activeEvent?.id || '');
    data.set('modelId', contact && modelId !== 'any' ? modelId : '');
    data.set('email', user.email);
    data.set('consent', 'true');
    data.set('idempotencyKey', idempotencyKey.current);
    if (type === 'model') photos.forEach(file => data.append('photos', file));
    try {
      const result = await api<{ application: Application }>('/api/applications', { method: 'POST', body: data });
      setReceipt(result.application);
      setDirty(false);
      setPhotos([]);
      idempotencyKey.current = null;
    } catch (problem) {
      if (problem instanceof ApiError) {
        setFieldErrors(problem.fieldErrors);
        if (problem.status === 401) setReauth(true);
        setError(problem.status === 401 ? 'Время входа истекло. Войдите снова — поля формы пока сохранены на экране.' : problem.message);
        if ([400, 409, 413, 422].includes(problem.status)) idempotencyKey.current = null;
      } else { setError('Не удалось отправить анкету. Проверьте соединение и повторите попытку.'); }
    } finally { sending.current = false; setBusy(false); }
  }


  async function restoreSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); event.stopPropagation();
    if (!user || reauthBusy) return;
    const password = String(new FormData(event.currentTarget).get('sessionPassword') || '');
    setReauthBusy(true); setReauthError('');
    try {
      const result = await jsonRequest<{ user: User }>('/api/auth/login', 'POST', { email: user.email, password });
      acceptUser(result.user); setReauth(false); setError('');
    } catch (problem) { setReauthError(problem instanceof Error ? problem.message : 'Не удалось восстановить вход.'); }
    finally { setReauthBusy(false); }
  }

  if (loading) return <FormSkeleton />;
  if (!user) return <div className="sign-in-gate"><p className="eyebrow">ВАШИ ЗАЯВКИ — В ЛИЧНОМ КАБИНЕТЕ</p><h2>Сначала познакомимся.</h2><p>Войдите или создайте аккаунт, чтобы отправить анкету, сохранить фотографии и следить за рассмотрением заявки.</p>{sessionError && <Alert severity="error" action={<Button onClick={() => void refresh()}>Повторить</Button>}>{sessionError}</Alert>}<div className="form-action-row"><Link href={`/login?next=${encodeURIComponent(next)}`} className="button button-dark">Войти <Arrow /></Link><Link href={`/register?next=${encodeURIComponent(next)}`} className="text-link">Создать аккаунт <Arrow /></Link></div></div>;
  if (receipt) return <div className="form-success" role="status"><span className="receipt-check" aria-hidden="true">✓</span><p className="eyebrow">ЗАЯВКА {receipt.reference}</p><h2>{receipt.status === 'waiting' ? 'Вы в листе ожидания.' : 'Анкета отправлена.'}</h2><p>Данные{receipt.photos.length ? ' и фотографии' : ''} сохранены на сервере. {receipt.status === 'waiting' ? 'Свободные места закончились. Команда увидит вашу запись и сможет подтвердить участие.' : 'Команда увидит заявку в своём кабинете. Статус рассмотрения можно проверить в личном кабинете.'}</p><div className="receipt-summary"><strong>{receipt.title}</strong><span>{receipt.name} · {receipt.email}</span></div><div className="form-action-row"><Link className="button button-dark" href="/account">Мои заявки <Arrow /></Link><Button onClick={() => setReceipt(null)}>Заполнить другую анкету</Button></div></div>;

  return <form className="application-form" onSubmit={submit} onChange={() => setDirty(true)}>
    <div className="form-note">После отправки вы получите номер заявки. Контакты и фотографии доступны вам и уполномоченной команде агентства.</div>
    <div ref={errorRef} tabIndex={-1} className="form-error-anchor">{error && <Alert severity="error">{error}</Alert>}</div>
    {invalidReference && <Alert severity="warning" action={<Button component={Link} href={contact ? "/contact" : "/casting"}>Сбросить ссылку</Button>}>Ссылка на проект или модель некорректна. Откройте актуальную карточку из каталога.</Alert>}
    <fieldset className="application-fields" disabled={busy}>
      <legend className="visually-hidden">Анкета {contact ? 'сотрудничества' : 'участника'}</legend>
      <p className="form-section-label">01 / {contact ? 'ВАШ ПРОЕКТ' : 'НАПРАВЛЕНИЕ'}</p>
      {contact ? <TextField select label="Выбранная модель" value={modelId} onChange={event => setModelId(event.target.value)}><MenuItem value="any">Помогите подобрать модель</MenuItem>{models.map(model => <MenuItem key={model.id} value={model.id}>{model.name} · {model.city}</MenuItem>)}</TextField> : <TextField select label={viewer ? 'Запись зрителем на показ' : 'Кастинг, событие или курс'} value={selection} onChange={event => { setSelection(event.target.value); setError(''); setFieldErrors({}); }} {...field('targetId')}><MenuItem value="general" disabled={viewer}>Стать моделью · общая анкета</MenuItem>{eligibleEvents.map(item => <MenuItem key={item.id} value={`event:${item.id}`}>{item.title} · {formatEventDate(item.date)}</MenuItem>)}{activeEvent && !eligibleEvents.some(item => item.id === activeEvent.id) && <MenuItem value={`event:${activeEvent.id}`}>{activeEvent.title} · приём закрыт</MenuItem>}{!viewer && eligibleCourses.map(course => <MenuItem key={course.id} value={`course:${course.id}`}>{course.title} · обучение</MenuItem>)}{activeCourse && !eligibleCourses.some(course => course.id === activeCourse.id) && <MenuItem value={`course:${activeCourse.id}`}>{activeCourse.title} · набор завершён</MenuItem>}</TextField>}
      {!contact && viewer && <Alert severity="info">Это запись на посещение показа. Для участия в качестве модели откройте анкету из раздела «Кастинги».</Alert>}
      {unavailable && <Alert severity="warning">Набор на этот проект завершён или запись недоступна. Выберите другую возможность.</Alert>}
      <p className="form-section-label">02 / КОНТАКТЫ</p>
      <div className="form-fields">
        <TextField name="name" label={contact ? 'Имя / бренд' : 'Имя и фамилия'} defaultValue={user.name} autoComplete="name" required slotProps={{ htmlInput: { minLength: 2, maxLength: 100 } }} {...field('name')} />
        <TextField name="email" label="Email аккаунта" value={user.email} slotProps={{ input: { readOnly: true } }} helperText="Ответ и статус заявки будут доступны в кабинете." />
        <TextField name="city" label="Город" defaultValue={user.city} autoComplete="address-level2" required slotProps={{ htmlInput: { minLength: 2, maxLength: 80 } }} {...field('city')} />
        <TextField name="phone" label="Телефон" type="tel" autoComplete="tel" placeholder="+7 700 123 45 67" required slotProps={{ htmlInput: { maxLength: 25 } }} {...field('phone')} />
      </div>
      {type === 'collaboration' && <div className="form-fields"><TextField name="projectDate" type="date" label="Планируемая дата" required slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today } }} {...field('projectDate')} /><TextField name="projectType" select label="Формат проекта" defaultValue="Editorial" {...field('projectType')}>{['Editorial', 'Показ', 'Реклама', 'Другое'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></div>}
      {type === 'model' && <><p className="form-section-label">03 / ПАРАМЕТРЫ</p><div className="form-fields"><TextField name="age" label="Возраст, лет" type="number" required slotProps={{ htmlInput: { min: 18, max: 80 } }} {...field('age')} /><TextField name="height" label="Рост, см" type="number" required slotProps={{ htmlInput: { min: 140, max: 220 } }} {...field('height')} /></div><div className="measurements-fields">{[['chest', 'Грудь, см'], ['waist', 'Талия, см'], ['hips', 'Бёдра, см']].map(([name, label]) => <TextField key={name} name={name} label={label} type="number" required slotProps={{ htmlInput: { min: 40, max: 180 } }} error={!!fieldErrors.measurements} />)}</div>{fieldErrors.measurements && <p className="form-error">{fieldErrors.measurements}</p>}</>}
      <TextField name="description" label={contact ? 'О проекте, бюджете и условиях' : viewer ? 'Комментарий (необязательно)' : type === 'course' ? 'Опыт и цель обучения (необязательно)' : 'Опыт и немного о себе'} multiline minRows={4} required={contact} slotProps={{ htmlInput: { maxLength: 2000 } }} {...field('description')} />
      {type === 'model' && <><p className="form-section-label">04 / ФОТОГРАФИИ</p><div className="upload-field"><strong>Портрет, профиль или полный рост</strong><small>До 3 фотографий JPEG, PNG или WebP, до 5 МБ и 20 мегапикселей каждая. Естественный свет, без сильных фильтров.</small><Button variant="outlined" component="label" disabled={readingPhotos || photos.length >= 3}>{readingPhotos ? 'Проверяем фотографии…' : 'Добавить фотографии'}<input hidden type="file" multiple accept={photoTypes.join(',')} onChange={event => void addPhotos(event)} aria-label="Добавить фотографии" /></Button>{fieldErrors.photos && <p className="form-error">{fieldErrors.photos}</p>}</div>{photos.length > 0 && <ul className="photo-preview-list">{photos.map((file, index) => <PhotoPreview key={`${file.name}-${file.size}-${file.lastModified}-${index}`} file={file} remove={() => { setPhotos(current => current.filter((_, itemIndex) => itemIndex !== index)); setDirty(true); }} />)}</ul>}</>}
      <FormControlLabel control={<Checkbox required name="consent" value="true" size="small" />} label={<span className="consent-label">Согласен на обработку введённых данных и фотографий для рассмотрения этой заявки. <Link href="/privacy" target="_blank" rel="noopener noreferrer">Как хранятся данные</Link></span>} />
      {fieldErrors.consent && <p className="form-error">{fieldErrors.consent}</p>}
      <Button variant="contained" type="submit" disabled={busy || readingPhotos || unavailable || invalidReference} endIcon={busy ? <CircularProgress size={18} color="inherit" /> : <Arrow />} sx={{ width: '100%', justifyContent: 'space-between' }}>{busy ? 'Отправляем анкету…' : type === 'viewer' ? 'Записаться зрителем' : type === 'course' ? 'Отправить заявку на обучение' : 'Отправить анкету'}</Button>
    </fieldset>
    <Dialog open={reauth} onClose={() => !reauthBusy && setReauth(false)} fullWidth maxWidth="sm" aria-labelledby="restore-session-title"><form onSubmit={restoreSession}><DialogTitle id="restore-session-title">Войдите снова</DialogTitle><DialogContent><p className="muted">Срок входа истёк. Подтвердите пароль — заполненная анкета и выбранные фото останутся на месте.</p><div className="application-form">{reauthError && <Alert severity="error">{reauthError}</Alert>}<TextField label="Email" value={user.email} slotProps={{ input: { readOnly: true } }} /><TextField autoFocus name="sessionPassword" label="Пароль" type="password" autoComplete="current-password" required disabled={reauthBusy} slotProps={{ htmlInput: { maxLength: 128 } }} /></div></DialogContent><DialogActions><Button onClick={() => setReauth(false)} disabled={reauthBusy}>Закрыть</Button><Button type="submit" variant="contained" disabled={reauthBusy}>{reauthBusy ? 'Входим…' : 'Восстановить вход'}</Button></DialogActions></form></Dialog>
  </form>;
}
function QueryForm({ contact }: { contact: boolean }) {
  const query = useSearchParams();
  const { user } = useSession();
  return <ApplicationForm key={`${user?.id || 'guest'}:${query.toString()}`} contact={contact} />;
}
export function RequestForm({ contact = false }: { contact?: boolean }) { return <Suspense fallback={<FormSkeleton />}><QueryForm contact={contact} /></Suspense>; }
export function FormImage({ contact = false }: { contact?: boolean }) { return <div className="form-aside-image"><Image src={contact ? '/images/editorial-01.jpg' : '/images/model-03.jpg'} alt={contact ? 'Редакционная fashion-съёмка' : 'Редакционный портрет модели'} fill sizes="(max-width:600px) 100vw, 35vw" /></div>; }
