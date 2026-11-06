'use client';
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, CircularProgress, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, IconButton, InputAdornment, MenuItem, Skeleton, Tab, Tabs, TextField } from '@mui/material';
import type { Application, User } from '@/types/api';
import { api, ApiError, jsonRequest, safeReturnTo } from '@/lib/client-api';
import { APPLICATION_STATUS_LABELS, APPLICATION_TYPE_LABELS, MIN_PASSWORD_LENGTH, validateLogin, validateRegister, validatePasswordChange, validateProfile } from '@/lib/validation';
import { models } from '@/data/models';
import ModelCard from './models/ModelCard';
import { useModelFavorites } from './models/favorite-store';
import { useSession } from './session-provider';
import { ApplicationDetails, formatTimestamp, StatusChip } from './application-details';
import { Arrow } from './site-shell';
import './models/models.css';
import './forms.css';

function PasswordField({ name, label, autoComplete, minLength, error, helperText }: { name: string; label: string; autoComplete: string; minLength?: number; error?: boolean; helperText?: string }) {
  const [visible, setVisible] = useState(false);
  return <TextField name={name} label={label} type={visible ? 'text' : 'password'} autoComplete={autoComplete} required error={error} helperText={helperText} slotProps={{ htmlInput: { minLength, maxLength: 128 }, input: { endAdornment: <InputAdornment position="end"><IconButton type="button" size="small" aria-label={visible ? `Скрыть: ${label}` : `Показать: ${label}`} aria-pressed={visible} onClick={() => setVisible(old => !old)}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{visible && <path d="m3 3 18 18" />}</svg></IconButton></InputAdornment> } }} />;
}
function AuthContent({ register }: { register: boolean }) {
  const router = useRouter();
  const query = useSearchParams();
  const { user, loading, acceptUser } = useSession();
  const next = safeReturnTo(query.get('next'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    api<{ user: User | null }>('/api/auth/me', { signal: controller.signal }).then(data => acceptUser(data.user)).catch(problem => { if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : 'Не удалось проверить вход.'); }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, [acceptUser]);
  const sending = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (sending.current) return;
    const data = new FormData(event.currentTarget);
    const payload = { name: String(data.get('name') || '').trim(), email: String(data.get('email') || '').trim(), city: String(data.get('city') || '').trim(), password: String(data.get('password') || ''), consent: data.get('consent') === 'true' };
    const validation = register ? validateRegister(payload) : validateLogin(payload);
    const errors = { ...validation.fieldErrors };
    if (register && payload.password !== data.get('confirmation')) errors.confirmation = 'Пароли не совпадают.';
    if (Object.keys(errors).length) { setFields(errors); setError('Проверьте отмеченные поля.'); return; }
    sending.current = true; setBusy(true); setError(''); setFields({});
    try {
      const result = await jsonRequest<{ user: User }>(register ? '/api/auth/register' : '/api/auth/login', 'POST', payload);
      acceptUser(result.user); router.replace(next); router.refresh();
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Не удалось войти.'); if (problem instanceof ApiError) setFields(problem.fieldErrors); }
    finally { sending.current = false; setBusy(false); }
  }
  const field = (name: string) => ({ error: !!fields[name], helperText: fields[name] });
  return <main id="main-content" className="auth-layout"><p className="eyebrow">RUNWAY COMMUNITY</p><h1>{register ? 'Твоя новая глава.' : 'С возвращением.'}</h1>{loading || checking ? <Skeleton height={250} /> : user ? <div className="form-success"><p>Вы уже вошли как {user.name}.</p><Link className="button button-dark" href={next}>Продолжить <Arrow /></Link></div> : <><p className="auth-description">{register ? 'Создайте аккаунт, чтобы отправлять анкеты, сохранять портфолио и следить за заявками.' : 'Войдите, чтобы продолжить заявку и открыть личный кабинет.'}</p><form className="application-form" onSubmit={submit}><div ref={errorRef} tabIndex={-1} className="form-error-anchor">{error && <Alert severity="error">{error}</Alert>}</div><fieldset className="application-fields" disabled={busy}><legend className="visually-hidden">{register ? 'Регистрация' : 'Вход'}</legend>{register && <><TextField name="name" label="Имя и фамилия" autoComplete="name" required slotProps={{ htmlInput: { minLength: 2, maxLength: 100 } }} {...field('name')} /><TextField name="city" label="Город" autoComplete="address-level2" required slotProps={{ htmlInput: { minLength: 2, maxLength: 80 } }} {...field('city')} /></>}<TextField name="email" label="Email" type="email" autoComplete="email" required slotProps={{ htmlInput: { maxLength: 254 } }} {...field('email')} /><PasswordField name="password" label="Пароль" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? MIN_PASSWORD_LENGTH : undefined} error={!!fields.password} helperText={fields.password || (register ? `От ${MIN_PASSWORD_LENGTH} до 128 символов. Не используйте пароль от других сервисов.` : undefined)} />{register && <><PasswordField name="confirmation" label="Повторите пароль" autoComplete="new-password" {...field('confirmation')} /><FormControlLabel control={<Checkbox required name="consent" value="true" size="small" />} label={<span className="consent-label">Согласен на обработку данных аккаунта. <Link href="/privacy" target="_blank" rel="noopener noreferrer">Как хранятся данные</Link></span>} /></>}<Button type="submit" variant="contained" disabled={busy} endIcon={busy ? <CircularProgress color="inherit" size={18} /> : <Arrow />}>{busy ? 'Подождите…' : register ? 'Создать аккаунт' : 'Войти'}</Button></fieldset></form><p className="auth-switch">{register ? 'Уже есть аккаунт?' : 'Впервые здесь?'} <Link href={`${register ? '/login' : '/register'}?next=${encodeURIComponent(next)}`}>{register ? 'Войти' : 'Зарегистрироваться'} <Arrow /></Link></p></>}</main>;
}
export function AuthForm({ register = false }: { register?: boolean }) { return <Suspense fallback={<main id="main-content" className="auth-layout"><Skeleton height={360} /></main>}><AuthContent register={register} /></Suspense>; }

export function SessionGate({ children, admin = false }: { children: (user: User) => React.ReactNode; admin?: boolean }) {
  const { user, loading, error, refresh } = useSession();
  if (loading) return <div className="page-shell gated-page" aria-busy="true"><Skeleton height={90} /><Skeleton height={230} /></div>;
  if (!user) return <div className="page-shell gated-page"><p className="eyebrow">RUNWAY ACCOUNT</p><h1>Ваше личное пространство.</h1><p>Войдите, чтобы открыть {admin ? 'управление агентством' : 'заявки, избранное и профиль'}.</p>{error && <Alert severity="error" action={<Button onClick={() => void refresh()}>Повторить</Button>}>{error}</Alert>}<div className="form-action-row"><Link className="button button-dark" href={`/login?next=${admin ? '/admin' : '/account'}`}>Войти <Arrow /></Link><Link className="text-link" href="/register">Создать аккаунт <Arrow /></Link></div></div>;
  if (admin && user.role !== 'admin') return <div className="page-shell gated-page"><p className="eyebrow">ДОСТУП ОГРАНИЧЕН</p><h1>Пространство команды.</h1><p>Управление заявками доступно сотрудникам с правами администратора.</p><Link className="button button-dark" href="/account">Мой кабинет <Arrow /></Link></div>;
  return <>{children(user)}</>;
}

function ProfileEditor({ user }: { user: User }) {
  const { acceptUser } = useSession();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [passwordVersion, setPasswordVersion] = useState(0);
  async function profile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget); const payload = { name: String(data.get('name') || ''), city: String(data.get('city') || '') };
    const validation = validateProfile(payload);
    if (!validation.value) { setFields(validation.fieldErrors); return; }
    setBusy(true); setError(''); setMessage(''); setFields({});
    try { const result = await jsonRequest<{ user: User }>('/api/profile', 'PATCH', payload); acceptUser(result.user); setEditing(false); setMessage('Профиль сохранён.'); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Не удалось сохранить профиль.'); if (problem instanceof ApiError) setFields(problem.fieldErrors); }
    finally { setBusy(false); }
  }
  async function password(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget); const payload = { currentPassword: String(data.get('currentPassword') || ''), newPassword: String(data.get('newPassword') || '') };
    const validation = validatePasswordChange(payload); const errors = { ...validation.fieldErrors };
    if (payload.newPassword !== data.get('confirmation')) errors.confirmation = 'Пароли не совпадают.';
    if (Object.keys(errors).length) { setFields(errors); return; }
    setBusy(true); setError(''); setMessage(''); setFields({});
    try { await jsonRequest('/api/auth/password', 'POST', payload); setPasswordVersion(value => value + 1); setMessage('Пароль изменён.'); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Не удалось изменить пароль.'); if (problem instanceof ApiError) setFields(problem.fieldErrors); }
    finally { setBusy(false); }
  }
  return <div className="profile-editor">{message && <Alert severity="success">{message}</Alert>}{error && <Alert severity="error">{error}</Alert>}{editing ? <form className="application-form" onSubmit={profile}><TextField name="name" label="Имя и фамилия" defaultValue={user.name} required error={!!fields.name} helperText={fields.name} /><TextField name="city" label="Город" defaultValue={user.city} required error={!!fields.city} helperText={fields.city} /><div className="form-action-row"><Button type="submit" variant="contained" disabled={busy}>Сохранить</Button><Button onClick={() => { setEditing(false); setFields({}); }} disabled={busy}>Отмена</Button></div></form> : <div className="account-profile"><p className="eyebrow">МОЙ ПРОФИЛЬ</p><h2>{user.name}</h2><p>{user.email}</p><p className="muted">{user.city}</p><Button variant="outlined" onClick={() => { setEditing(true); setFields({}); setMessage(''); }}>Редактировать</Button></div>}<h2 className="profile-password-heading">Изменить пароль</h2><form key={passwordVersion} className="application-form" onSubmit={password}><PasswordField name="currentPassword" label="Текущий пароль" autoComplete="current-password" error={!!fields.currentPassword} helperText={fields.currentPassword} /><PasswordField name="newPassword" label="Новый пароль" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} error={!!fields.newPassword} helperText={fields.newPassword || `Минимум ${MIN_PASSWORD_LENGTH} символов.`} /><PasswordField name="confirmation" label="Повторите новый пароль" autoComplete="new-password" error={!!fields.confirmation} helperText={fields.confirmation} /><Button type="submit" variant="contained" disabled={busy}>{busy ? 'Сохраняем…' : 'Изменить пароль'}</Button></form></div>;
}
function MemberAccount({ user }: { user: User }) {
  const router = useRouter();
  const { logout, refresh } = useSession();
  const [records, setRecords] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [detail, setDetail] = useState<Application | null>(null);
  const [withdraw, setWithdraw] = useState<Application | null>(null);
  const [withdrawError, setWithdrawError] = useState('');
  const favoritesState = useModelFavorites();
  const favorites = favoritesState.ids;
  useEffect(() => {
    const controller = new AbortController();
    api<{ applications: Application[] }>('/api/applications', { signal: controller.signal }).then(data => setRecords(data.applications)).catch(problem => { if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : 'Не удалось загрузить заявки.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user.id]);
  async function reload() {
    setLoading(true); setError('');
    try { const data = await api<{ applications: Application[] }>('/api/applications'); setRecords(data.applications); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Не удалось обновить заявки.'); if (problem instanceof ApiError && problem.status === 401) await refresh(); }
    finally { setLoading(false); }
  }
  async function withdrawApplication() {
    if (!withdraw || busy) return;
    setWithdrawError('');
    setBusy(true); setError('');
    try { const data = await jsonRequest<{ application: Application }>(`/api/applications/${withdraw.id}`, 'PATCH', { action: 'withdraw' }); setRecords(old => old.map(item => item.id === data.application.id ? data.application : item)); if (detail?.id === data.application.id) setDetail(data.application); setWithdraw(null); }
    catch (problem) { setWithdrawError(problem instanceof Error ? problem.message : 'Не удалось отозвать анкету.'); }
    finally { setBusy(false); }
  }
  async function signOut() { setBusy(true); setError(''); try { await logout(); router.replace('/login'); } catch (problem) { setError(problem instanceof Error ? problem.message : 'Не удалось выйти.'); } finally { setBusy(false); } }
  const filtered = records.filter(item => (status === 'all' || item.status === status) && `${item.title} ${item.reference}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
  return <><div className="page-heading"><p className="eyebrow">MY RUNWAY / ЛИЧНОЕ ПРОСТРАНСТВО</p><h1>Привет, {user.name.split(' ')[0]}.</h1><p>Здесь хранятся ваши анкеты, ответы команды, избранные модели и настройки профиля.</p></div><div className="account-toolbar"><span className="tag">{user.role === 'admin' ? 'Администратор' : 'Участник Runway'}</span><div className="form-action-row">{user.role === 'admin' && <Link className="text-link" href="/admin">Управление заявками <Arrow /></Link>}<Button onClick={() => void signOut()} disabled={busy}>Выйти из аккаунта</Button></div></div>{error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}<Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="scrollable" allowScrollButtonsMobile aria-label="Разделы кабинета" sx={{ borderBottom: '1px solid #d8d8d0', mb: 4 }}><Tab id="account-tab-0" aria-controls="account-panel-0" label={`Мои заявки (${records.length})`} /><Tab id="account-tab-1" aria-controls="account-panel-1" label={`Избранное (${favorites.length})`} /><Tab id="account-tab-2" aria-controls="account-panel-2" label="Профиль" /></Tabs>
  <section role="tabpanel" id={`account-panel-${tab}`} aria-labelledby={`account-tab-${tab}`}>
    {tab === 0 && <><div className="account-filters"><TextField size="small" label="Найти заявку" value={query} onChange={event => setQuery(event.target.value)} /><TextField size="small" label="Статус" select value={status} onChange={event => setStatus(event.target.value)}><MenuItem value="all">Все статусы</MenuItem>{Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField><Button variant="outlined" onClick={() => void reload()} disabled={loading}>Обновить</Button></div>{loading ? <div aria-busy="true" aria-label="Загрузка заявок"><Skeleton height={90} /><Skeleton height={90} /></div> : !records.length ? <div className="empty-state"><p className="eyebrow">ВСЁ ЕЩЁ ВПЕРЕДИ</p><h2>Первая возможность уже ждёт.</h2><p>Выберите событие, курс или заполните общую анкету модели.</p><Link className="button button-dark" href="/casting">Заполнить анкету <Arrow /></Link></div> : !filtered.length ? <div className="empty-state"><h2>Ничего не найдено.</h2><p>Попробуйте другой запрос или статус.</p><Button onClick={() => { setQuery(''); setStatus('all'); }}>Сбросить фильтры</Button></div> : filtered.map(item => <article className="account-record" key={item.id}><div><p className="eyebrow">{APPLICATION_TYPE_LABELS[item.type]} / {item.reference}</p><h3><button className="record-title-button" onClick={() => setDetail(item)}>{item.title} <Arrow /></button></h3><p>{formatTimestamp(item.createdAt)}</p></div><div className="record-actions"><StatusChip status={item.status} /><Button size="small" onClick={() => setDetail(item)}>Подробности</Button>{!['withdrawn', 'rejected'].includes(item.status) && <Button size="small" color="inherit" onClick={() => { setWithdrawError(''); setWithdraw(item); }}>Отозвать</Button>}</div></article>)}</>}
    {tab === 1 && <>{favoritesState.error && <Alert severity="error" action={<Button onClick={() => favoritesState.retry()}>Повторить</Button>}>{favoritesState.error}</Alert>}{favoritesState.loading ? <Skeleton height={250} /> : (favorites.length ? <div className="row g-4">{models.filter(model => favorites.includes(model.id)).map(model => <div className="col-12 col-sm-6 col-lg-4" key={model.id}><ModelCard model={model} /></div>)}</div> : <div className="empty-state"><h2>Сохраните то, что вдохновляет.</h2><p>Нажмите сердце в каталоге — портфолио появится здесь и сохранится в вашем аккаунте.</p><Link href="/models" className="button button-dark">Каталог моделей <Arrow /></Link></div>)}</>}
    {tab === 2 && <ProfileEditor user={user} />}
  </section><ApplicationDetails application={detail} onClose={() => setDetail(null)} /><Dialog open={!!withdraw} onClose={() => !busy && setWithdraw(null)} aria-labelledby="withdraw-title"><DialogTitle id="withdraw-title">Отозвать заявку?</DialogTitle><DialogContent>{withdrawError && <Alert severity="error" sx={{ mb: 2 }}>{withdrawError}</Alert>}<DialogContentText>Заявка «{withdraw?.title}» перестанет участвовать в отборе. Она останется в вашей истории со статусом «Отозвана».</DialogContentText></DialogContent><DialogActions><Button onClick={() => setWithdraw(null)} disabled={busy}>Оставить заявку</Button><Button onClick={() => void withdrawApplication()} disabled={busy} variant="contained">{busy ? 'Отзываем…' : 'Отозвать'}</Button></DialogActions></Dialog></>;
}
export function Account() { return <main id="main-content" className="page-shell account-section"><SessionGate>{user => <MemberAccount key={user.id} user={user} />}</SessionGate></main>; }
