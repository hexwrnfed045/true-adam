'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Image from 'next/image';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, TextField } from '@mui/material';
import type { Application, User } from '@/types/api';
import { api, ApiError, jsonRequest } from '@/lib/client-api';
import { applicationEditReason } from '@/lib/application-editing';
import { APPLICATION_TYPE_LABELS, PROJECT_TYPES, validateApplicationFields } from '@/lib/validation';
import { getToday } from '@/data/events';
import { useSession } from './session-provider';

const photoTypes = ['image/jpeg', 'image/png', 'image/webp'];
function initialValues(application: Application): Record<string, string> {
  const measurements = application.measurements.match(/\d+/g) ?? [];
  return {
    name: application.name, phone: application.phone, city: application.city,
    age: String(application.age ?? ''), height: String(application.height ?? ''),
    chest: measurements[0] ?? '', waist: measurements[1] ?? '', hips: measurements[2] ?? '',
    description: application.description, projectType: application.projectType,
    projectDate: application.projectDate,
  };
}

function NewPhoto({ file, remove }: { file: File; remove: () => void }) {
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <li className="photo-preview"><Image unoptimized src={url} alt={`Новое фото: ${file.name}`} width={110} height={140} /><div><strong>{file.name}</strong><small>Новое фото · {(file.size / 1024 / 1024).toFixed(1)} МБ</small></div><IconButton type="button" aria-label={`Удалить новое фото ${file.name}`} onClick={remove}>×</IconButton></li>;
}

function Editor({ application, onClose, onSaved }: { application: Application; onClose: () => void; onSaved: (application: Application) => void }) {
  const { user, acceptUser } = useSession();
  const [current, setCurrent] = useState(application);
  const [values, setValues] = useState(() => initialValues(application));
  const [keptIds, setKeptIds] = useState(() => application.photos.map(photo => photo.id));
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const [discard, setDiscard] = useState<'close' | 'reload' | null>(null);
  const [reauth, setReauth] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const sending = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const reason = applicationEditReason(current);
  const email = user?.email ?? current.email;
  const totalPhotos = keptIds.length + photos.length;

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function field(name: string) {
    return {
      name, value: values[name] ?? '',
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValues(old => ({ ...old, [name]: event.target.value })); setDirty(true);
      },
      error: !!fieldErrors[name], helperText: fieldErrors[name],
    };
  }
  function close() {
    if (busy || reading) return;
    if (dirty) setDiscard('close'); else onClose();
  }

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!selected.length || reading || busy) return;
    setReading(true);
    try {
      const unique = selected.filter(file => !photos.some(old => old.name === file.name && old.size === file.size && old.lastModified === file.lastModified));
      if (totalPhotos + unique.length > 3) throw new Error('Можно сохранить до 3 фотографий. Сначала удалите лишнюю.');
      for (const file of unique) {
        if (!photoTypes.includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) throw new Error(`«${file.name}»: нужен JPEG, PNG или WebP размером до 5 МБ.`);
        try { const bitmap = await createImageBitmap(file); const pixels = bitmap.width * bitmap.height; bitmap.close(); if (pixels > 20_000_000) throw new Error('resolution'); }
        catch { throw new Error(`«${file.name}»: изображение повреждено или больше 20 мегапикселей.`); }
      }
      setPhotos(old => [...old, ...unique]); setDirty(true); setError('');
      setFieldErrors(old => ({ ...old, photos: '', photoIds: '' }));
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Не удалось прочитать фотографию.'); }
    finally { setReading(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || reading || reason) return;
    const data = new FormData(event.currentTarget);
    data.set('type', current.type); data.set('targetId', current.targetId ?? ''); data.set('modelId', current.modelId ?? '');
    data.set('email', email); data.set('consent', 'true');
    if (current.type === 'model') data.set('measurements', ['chest', 'waist', 'hips'].map(name => values[name]).join('/'));
    else data.set('measurements', current.measurements);
    const validation = validateApplicationFields({ ...Object.fromEntries(data), idempotencyKey: crypto.randomUUID() });
    const errors = { ...validation.fieldErrors };
    if (current.type === 'model' && !totalPhotos) errors.photos = 'Оставьте или добавьте хотя бы одну фотографию.';
    if (Object.keys(errors).length) { setFieldErrors(errors); setError('Проверьте отмеченные поля. Изменения пока не сохранены.'); return; }
    data.set('action', 'edit'); data.set('expectedUpdatedAt', current.updatedAt); data.set('photoIds', JSON.stringify(keptIds));
    photos.forEach(file => data.append('photos', file));
    sending.current = true; setBusy(true); setError(''); setFieldErrors({});
    try {
      const result = await api<{ application: Application }>(`/api/applications/${current.id}`, { method: 'PATCH', body: data });
      setDirty(false); onSaved(result.application);
    } catch (problem) {
      if (problem instanceof ApiError) {
        setFieldErrors(problem.fieldErrors); setConflict(problem.status === 409);
        if (problem.status === 401) setReauth(true);
      }
      setError(problem instanceof Error ? problem.message : 'Не удалось сохранить заявку. Повторите попытку.');
    } finally { sending.current = false; setBusy(false); }
  }

  async function reload() {
    if (busy) return;
    setBusy(true); setError(''); setDiscard(null);
    try {
      const result = await api<{ application: Application }>(`/api/applications/${current.id}`);
      setCurrent(result.application); setValues(initialValues(result.application));
      setKeptIds(result.application.photos.map(photo => photo.id)); setPhotos([]);
      setDirty(false); setConflict(false); setFieldErrors({});
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Не удалось обновить заявку.'); }
    finally { setBusy(false); }
  }

  async function restoreSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authBusy) return;
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    setAuthBusy(true); setAuthError('');
    try {
      const result = await jsonRequest<{ user: User }>('/api/auth/login', 'POST', { email, password });
      acceptUser(result.user); setReauth(false); setError('');
    } catch (problem) { setAuthError(problem instanceof Error ? problem.message : 'Не удалось восстановить вход.'); }
    finally { setAuthBusy(false); }
  }

  return <>
    <Dialog open onClose={close} fullWidth maxWidth="md" aria-labelledby="application-edit-title" slotProps={{ paper: { className: 'application-edit-dialog' } }}>
      <form onSubmit={save}>
        <DialogTitle id="application-edit-title">Редактировать заявку <span className="editor-reference">{current.reference}</span></DialogTitle>
        <DialogContent>
          <p className="muted">{APPLICATION_TYPE_LABELS[current.type]} · {current.title}</p>
          <Alert severity="info" sx={{ mb: 3 }}>После сохранения заявка поступит на повторное рассмотрение. Данные{current.type === 'model' ? ' и фотографии' : ''} будут подставляться в следующие заявки этого типа.</Alert>
          {reason && <Alert severity="warning" sx={{ mb: 2 }}>{reason}</Alert>}
          <div ref={errorRef} tabIndex={-1} className="form-error-anchor">{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}</div>
          {conflict && <Button onClick={() => dirty ? setDiscard('reload') : void reload()} disabled={busy} sx={{ mb: 2 }}>Загрузить актуальную версию</Button>}
          <fieldset className="application-fields application-editor-fields" disabled={busy || !!reason}>
            <legend className="visually-hidden">Данные отправленной заявки</legend>
            <div className="form-fields">
              <TextField label={current.type === 'collaboration' ? 'Имя / бренд' : 'Имя и фамилия'} required autoComplete="name" {...field('name')} slotProps={{ htmlInput: { minLength: 2, maxLength: 100 } }} />
              <TextField label="Email аккаунта" value={email} slotProps={{ input: { readOnly: true } }} helperText="Используется текущий email для входа." />
              <TextField label="Город" required autoComplete="address-level2" {...field('city')} slotProps={{ htmlInput: { minLength: 2, maxLength: 80 } }} />
              <TextField label="Телефон" required type="tel" autoComplete="tel" {...field('phone')} slotProps={{ htmlInput: { maxLength: 30 } }} />
            </div>
            {current.type === 'model' && <>
              <div className="form-fields"><TextField label="Возраст, лет" type="number" required {...field('age')} slotProps={{ htmlInput: { min: 18, max: 80, step: 1 } }} /><TextField label="Рост, см" type="number" required {...field('height')} slotProps={{ htmlInput: { min: 140, max: 220, step: 1 } }} /></div>
              <div className="measurements-fields">{[['chest', 'Грудь, см'], ['waist', 'Талия, см'], ['hips', 'Бёдра, см']].map(([name, label]) => <TextField key={name} label={label} type="number" required {...field(name)} error={!!fieldErrors.measurements} slotProps={{ htmlInput: { min: 40, max: 180 } }} />)}</div>
              {fieldErrors.measurements && <p className="form-error">{fieldErrors.measurements}</p>}
            </>}
            {current.type === 'course' && <TextField label="Возраст, лет (необязательно)" type="number" {...field('age')} slotProps={{ htmlInput: { min: 18, max: 80 } }} />}
            {current.type === 'collaboration' && <div className="form-fields"><TextField label="Планируемая дата" type="date" required {...field('projectDate')} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: getToday() } }} /><TextField label="Формат проекта" select required {...field('projectType')}>{PROJECT_TYPES.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></div>}
            <TextField label={current.type === 'collaboration' ? 'О проекте, бюджете и условиях' : current.type === 'model' ? 'Опыт и немного о себе' : 'Комментарий к заявке'} multiline minRows={4} required={current.type === 'collaboration'} {...field('description')} slotProps={{ htmlInput: { maxLength: 2000 } }} />
            {current.type === 'model' && <section className="application-editor-photos" aria-labelledby="edit-photos-title"><h3 id="edit-photos-title">Фотографии · {totalPhotos} из 3</h3><p className="form-note">Сохранённые фотографии можно оставить, удалить или заменить. Для заявки модели нужна хотя бы одна.</p>
              {!!totalPhotos && <ul className="photo-preview-list">{current.photos.filter(photo => keptIds.includes(photo.id)).map(photo => <li className="photo-preview" key={photo.id}><Image unoptimized src={photo.url} alt={`Сохранённое фото: ${photo.name}`} width={110} height={140} /><div><strong>{photo.name}</strong><small>Сохранённое фото</small></div><IconButton type="button" aria-label={`Удалить сохранённое фото ${photo.name}`} onClick={() => { setKeptIds(ids => ids.filter(id => id !== photo.id)); setDirty(true); }} disabled={busy || reading}>×</IconButton></li>)}{photos.map((file, index) => <NewPhoto key={`${file.name}-${file.lastModified}-${index}`} file={file} remove={() => { setPhotos(old => old.filter((_, item) => item !== index)); setDirty(true); }} />)}</ul>}
              <Button variant="outlined" component="label" disabled={busy || reading || totalPhotos >= 3}>{reading ? 'Проверяем фотографии…' : 'Добавить фотографии'}<input hidden type="file" multiple accept={photoTypes.join(',')} onChange={event => void addPhotos(event)} disabled={busy || reading} aria-label="Добавить фотографии к заявке" /></Button>
              {(fieldErrors.photos || fieldErrors.photoIds) && <p className="form-error">{fieldErrors.photos || fieldErrors.photoIds}</p>}
            </section>}
          </fieldset>
        </DialogContent>
        <DialogActions><Button onClick={close} disabled={busy || reading}>Отмена</Button><Button type="submit" variant="contained" disabled={busy || reading || !!reason || !dirty} endIcon={busy ? <CircularProgress size={18} color="inherit" /> : undefined}>{busy ? 'Сохраняем…' : 'Сохранить изменения'}</Button></DialogActions>
      </form>
    </Dialog>
    <Dialog open={!!discard} onClose={() => setDiscard(null)} aria-labelledby="discard-edit-title"><DialogTitle id="discard-edit-title">Отменить несохранённые изменения?</DialogTitle><DialogContent><p>{discard === 'reload' ? 'Текущая форма будет заменена актуальной версией заявки с сервера.' : 'Введённые изменения и новые фотографии не будут сохранены.'}</p></DialogContent><DialogActions><Button onClick={() => setDiscard(null)}>Продолжить редактирование</Button><Button onClick={() => discard === 'reload' ? void reload() : onClose()}>Отменить изменения</Button></DialogActions></Dialog>
    <Dialog open={reauth} onClose={() => !authBusy && setReauth(false)} fullWidth maxWidth="sm" aria-labelledby="edit-login-title"><form onSubmit={restoreSession}><DialogTitle id="edit-login-title">Войдите снова</DialogTitle><DialogContent><p className="muted">Подтвердите вход — изменения и выбранные фото останутся в форме.</p><div className="application-form">{authError && <Alert severity="error">{authError}</Alert>}<TextField label="Email" value={email} slotProps={{ input: { readOnly: true } }} /><TextField autoFocus name="password" label="Пароль" type="password" required autoComplete="current-password" disabled={authBusy} /></div></DialogContent><DialogActions><Button onClick={() => setReauth(false)} disabled={authBusy}>Закрыть</Button><Button type="submit" variant="contained" disabled={authBusy}>{authBusy ? 'Входим…' : 'Восстановить вход'}</Button></DialogActions></form></Dialog>
  </>;
}

export function ApplicationEditor({ application, onClose, onSaved }: { application: Application | null; onClose: () => void; onSaved: (application: Application) => void }) {
  return application ? <Editor key={application.id} application={application} onClose={onClose} onSaved={onSaved} /> : null;
}
