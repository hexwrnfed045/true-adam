'use client';
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, CircularProgress, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, IconButton, InputAdornment, MenuItem, Skeleton, Tab, Tabs, TextField } from '@mui/material';
import type { Application, User, UserRole } from '@/types/api';
import { REGISTRATION_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, canModerate } from '@/lib/roles';
import { api, ApiError, jsonRequest, safeReturnTo } from '@/lib/client-api';
import { APPLICATION_TYPE_LABELS, MIN_PASSWORD_LENGTH, normalizeEmail, validateLogin, validateRegister, validatePasswordChange, validateProfile } from '@/lib/validation';
import { calculateAge } from '@/lib/profile';
import { formatEventDate, getToday } from '@/data/events';
import { models } from '@/data/models';
import ModelCard from './models/ModelCard';
import { useModelFavorites } from './models/favorite-store';
import { useSession } from './session-provider';
import { ApplicationDetails, formatTimestamp, StatusChip } from './application-details';
import { ApplicationEditor } from './application-editor';
import { applicationEditReason, canEditApplication } from '@/lib/application-editing';
import { ApplicationFilterControls } from './application-filters';
import { defaultApplicationFilters, filterApplications } from '@/lib/application-ui';
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
  const [registrationRole, setRegistrationRole] = useState<UserRole>('viewer');
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
    const payload = { name: String(data.get('name') || '').trim(), email: String(data.get('email') || '').trim(), city: String(data.get('city') || '').trim(), password: String(data.get('password') || ''), consent: data.get('consent') === 'true', ...(register ? { role: registrationRole } : {}) };
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
  return <main id="main-content" className="auth-layout"><p className="eyebrow">RUNWAY COMMUNITY</p><h1>{register ? 'Твоя новая глава.' : 'С возвращением.'}</h1>{loading || checking ? <Skeleton height={250} /> : user ? <div className="form-success"><p>Вы уже вошли как {user.name}. Тип аккаунта: {ROLE_LABELS[user.role]}.</p><Link className="button button-dark" href={next}>Продолжить <Arrow /></Link></div> : <><p className="auth-description">{register ? 'Выберите тип аккаунта: кабинет подскажет действия для вашей роли.' : 'Войдите, чтобы продолжить заявку и открыть личный кабинет.'}</p><form className="application-form" onSubmit={submit}><div ref={errorRef} tabIndex={-1} className="form-error-anchor">{error && <Alert severity="error">{error}</Alert>}</div><fieldset className="application-fields" disabled={busy}><legend className="visually-hidden">{register ? 'Регистрация' : 'Вход'}</legend>{register && <><TextField select name="role" label="Тип аккаунта" value={registrationRole} onChange={event => setRegistrationRole(event.target.value as UserRole)} error={!!fields.role} helperText={fields.role || ROLE_DESCRIPTIONS[registrationRole]} required>{REGISTRATION_ROLES.map(role => <MenuItem key={role} value={role}>{ROLE_LABELS[role]}</MenuItem>)}</TextField><p className="registration-role-note">Доступ модератора назначает администратор платформы.</p><TextField name="name" label="Имя и фамилия" autoComplete="name" required slotProps={{ htmlInput: { minLength: 2, maxLength: 100 } }} {...field('name')} /><TextField name="city" label="Город" autoComplete="address-level2" required slotProps={{ htmlInput: { minLength: 2, maxLength: 80 } }} {...field('city')} /></>}<TextField name="email" label="Email" type="email" autoComplete="email" required slotProps={{ htmlInput: { maxLength: 254 } }} {...field('email')} /><PasswordField name="password" label="Пароль" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? MIN_PASSWORD_LENGTH : undefined} error={!!fields.password} helperText={fields.password || (register ? `От ${MIN_PASSWORD_LENGTH} до 128 символов. Не используйте пароль от других сервисов.` : undefined)} />{register && <><PasswordField name="confirmation" label="Повторите пароль" autoComplete="new-password" {...field('confirmation')} /><FormControlLabel control={<Checkbox required name="consent" value="true" size="small" />} label={<span className="consent-label">Согласен на обработку данных аккаунта. <Link href="/privacy" target="_blank" rel="noopener noreferrer">Как хранятся данные</Link></span>} /></>}<Button type="submit" variant="contained" disabled={busy} endIcon={busy ? <CircularProgress color="inherit" size={18} /> : <Arrow />}>{busy ? 'Подождите…' : register ? 'Создать аккаунт' : 'Войти'}</Button></fieldset></form><p className="auth-switch">{register ? 'Уже есть аккаунт?' : 'Впервые здесь?'} <Link href={`${register ? '/login' : '/register'}?next=${encodeURIComponent(next)}`}>{register ? 'Войти' : 'Зарегистрироваться'} <Arrow /></Link></p><p className="auth-guest">Гость может смотреть события и портфолио без аккаунта. <Link href="/">Продолжить как гость</Link></p></>}</main>;
}
export function AuthForm({ register = false }: { register?: boolean }) { return <Suspense fallback={<main id="main-content" className="auth-layout"><Skeleton height={360} /></main>}><AuthContent register={register} /></Suspense>; }

export function SessionGate({ children, admin = false }: { children: (user: User) => React.ReactNode; admin?: boolean }) {
  const { user, loading, error, refresh } = useSession();
  if (loading) return <div className="page-shell gated-page" aria-busy="true"><Skeleton height={90} /><Skeleton height={230} /></div>;
  if (!user) return <div className="page-shell gated-page"><p className="eyebrow">RUNWAY ACCOUNT</p><h1>Ваше личное пространство.</h1><p>Войдите, чтобы открыть {admin ? 'управление агентством' : 'заявки, избранное и профиль'}.</p>{error && <Alert severity="error" action={<Button onClick={() => void refresh()}>Повторить</Button>}>{error}</Alert>}<div className="form-action-row"><Link className="button button-dark" href={`/login?next=${admin ? '/admin' : '/account'}`}>Войти <Arrow /></Link><Link className="text-link" href="/register">Создать аккаунт <Arrow /></Link></div></div>;
  if (admin && !canModerate(user.role)) return <div className="page-shell gated-page"><p className="eyebrow">ДОСТУП ОГРАНИЧЕН</p><h1>Пространство команды.</h1><p>Управление заявками доступно модераторам и администраторам.</p><Link className="button button-dark" href="/account">Мой кабинет <Arrow /></Link></div>;
  return <>{children(user)}</>;
}

const profileMeasurements = [
  { name: 'height', label: 'Рост', min: 140, max: 220 },
  { name: 'chest', label: 'Обхват груди', min: 40, max: 180 },
  { name: 'waist', label: 'Обхват талии', min: 40, max: 180 },
  { name: 'hips', label: 'Обхват бёдер', min: 40, max: 180 },
] as const;

function ProfileEditor({ user }: { user: User }) {
  const { acceptUser } = useSession();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(user.email);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [passwordVersion, setPasswordVersion] = useState(0);
  const emailChanged = normalizeEmail(email) !== normalizeEmail(user.email);

  async function profile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const read = (name: string) => String(data.get(name) ?? '').trim();
    const measurements = Object.fromEntries(profileMeasurements.map(({ name }) => {
      const value = read(name);
      return [name, value ? Number(value) : null];
    }));
    const payload = {
      name: read('name'),
      city: read('city'),
      email: read('email'),
      phone: read('phone'),
      birthDate: read('birthDate'),
      experience: read('experience'),
      ...measurements,
    };
    setMessage('');
    setError('');
    const validation = validateProfile(payload);
    if (!validation.value) {
      setFields(validation.fieldErrors);
      return;
    }
    setBusy(true);
    setFields({});
    try {
      const result = await jsonRequest<{ user: User }>('/api/profile', 'PATCH', {
        ...validation.value,
        ...(emailChanged ? { currentPassword: String(data.get('currentPassword') ?? '') } : {}),
      });
      acceptUser(result.user);
      setEditing(false);
      setMessage('Профиль сохранён.');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Не удалось сохранить профиль.');
      if (problem instanceof ApiError) setFields(problem.fieldErrors);
    } finally {
      setBusy(false);
    }
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

  function startEditing() {
    setEmail(user.email);
    setFields({});
    setMessage('');
    setError('');
    setEditing(true);
  }

  const age = calculateAge(user.birthDate);
  const profileField = (name: string) => ({ error: !!fields[name], helperText: fields[name] });
  return (
    <div className="profile-editor">
      {message && <Alert severity="success">{message}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {editing ? (
        <form onSubmit={profile}>
          <fieldset className="application-fields" disabled={busy}>
            <legend className="visually-hidden">Данные профиля</legend>
            <div className="form-fields">
              <TextField name="name" label="Имя и фамилия" defaultValue={user.name} autoComplete="name" required slotProps={{ htmlInput: { minLength: 2, maxLength: 100 } }} {...profileField('name')} />
              <TextField name="city" label="Город" defaultValue={user.city} autoComplete="address-level2" required slotProps={{ htmlInput: { minLength: 2, maxLength: 80 } }} {...profileField('city')} />
              <TextField name="email" label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required slotProps={{ htmlInput: { maxLength: 254 } }} {...profileField('email')} />
              <TextField name="phone" label="Телефон" type="tel" defaultValue={user.phone ?? ''} autoComplete="tel" slotProps={{ htmlInput: { maxLength: 30 } }} {...profileField('phone')} />
              {emailChanged && (
                <div className="full">
                  <PasswordField name="currentPassword" label="Текущий пароль для смены email" autoComplete="current-password" {...profileField('currentPassword')} />
                </div>
              )}
              <TextField
                name="birthDate"
                label="Дата рождения"
                type="date"
                defaultValue={user.birthDate ?? ''}
                autoComplete="bday"
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: getToday() } }}
                error={!!fields.birthDate}
                helperText={fields.birthDate || 'Возраст рассчитывается автоматически.'}
              />
            </div>
            <div className="form-fields">
              {profileMeasurements.map(({ name, label, min, max }) => (
                <TextField
                  key={name}
                  name={name}
                  label={`${label}, см`}
                  type="number"
                  defaultValue={user[name] ?? ''}
                  slotProps={{ htmlInput: { min, max, step: 1 } }}
                  {...profileField(name)}
                />
              ))}
            </div>
            <TextField name="experience" label="О себе и опыте" defaultValue={user.experience ?? ''} multiline minRows={3} slotProps={{ htmlInput: { maxLength: 2000 } }} {...profileField('experience')} />
            <div className="form-action-row">
              <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</Button>
              <Button onClick={() => { setEditing(false); setFields({}); setError(''); }} disabled={busy}>Отмена</Button>
            </div>
          </fieldset>
        </form>
      ) : (
        <>
          <div className="account-profile">
            <h2>{user.name}</h2>
            <p>{user.email}</p>
            <dl className="application-detail-fields">
              <div><dt>Тип аккаунта</dt><dd>{ROLE_LABELS[user.role]}</dd></div><div><dt>Город</dt><dd>{user.city}</dd></div>
              {user.phone && <div><dt>Телефон</dt><dd>{user.phone}</dd></div>}
              {user.birthDate && <div><dt>Дата рождения</dt><dd>{formatEventDate(user.birthDate, { day: 'numeric', month: 'long', year: 'numeric' })}</dd></div>}
              {age !== null && <div><dt>Возраст, лет</dt><dd>{age}</dd></div>}
              {profileMeasurements.map(({ name, label }) => user[name] != null && (
                <div key={name}><dt>{label}</dt><dd>{user[name]} см</dd></div>
              ))}
            </dl>
            {user.experience && <section className="detail-text"><h3>О себе и опыте</h3><p>{user.experience}</p></section>}
            <Button variant="outlined" sx={{ mt: 2 }} onClick={startEditing} disabled={busy}>Редактировать</Button>
          </div>
          <h2 className="profile-password-heading">Изменить пароль</h2>
          <form key={passwordVersion} className="application-form" onSubmit={password}>
            <PasswordField name="currentPassword" label="Текущий пароль" autoComplete="current-password" {...profileField('currentPassword')} />
            <PasswordField name="newPassword" label="Новый пароль" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} error={!!fields.newPassword} helperText={fields.newPassword || `Минимум ${MIN_PASSWORD_LENGTH} символов.`} />
            <PasswordField name="confirmation" label="Повторите новый пароль" autoComplete="new-password" {...profileField('confirmation')} />
            <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Сохраняем…' : 'Изменить пароль'}</Button>
          </form>
        </>
      )}
    </div>
  );
}

type AccountAction = { title: string; description: string; label: string; href: string };
const roleWorkspaces: Record<UserRole, { heading: string; description: string; actions: AccountAction[] }> = {
  viewer: {
    heading: 'Кабинет зрителя',
    description: 'Выбирайте открытые показы, сохраняйте модели и следите за своими записями.',
    actions: [
      { title: 'Ваше место на показе', description: 'Найдите открытое мероприятие и запишитесь зрителем.', label: 'Выбрать показ', href: '/events' },
      { title: 'Лица, которые вдохновляют', description: 'Сохраняйте интересные портфолио в избранное своего аккаунта.', label: 'Открыть каталог', href: '/models' },
    ],
  },
  model: {
    heading: 'Кабинет модели',
    description: 'Обновляйте свои параметры, отправляйте анкеты на кастинги и следите за ответами команды.',
    actions: [
      { title: 'Следующий выход', description: 'Подайте общую анкету или выберите открытый кастинг.', label: 'Подать анкету', href: '/casting' },
      { title: 'Работа перед камерой', description: 'Посмотрите проекты и условия участия в съёмках.', label: 'Найти съёмку', href: '/shoots' },
    ],
  },
  organizer: {
    heading: 'Кабинет организатора',
    description: 'Предлагайте показы и съёмки команде Runway. Ответы и статусы отправленных запросов доступны в ваших заявках.',
    actions: [
      { title: 'Новый проект', description: 'Опишите формат, город, даты и условия мероприятия в запросе на сотрудничество.', label: 'Предложить проект', href: '/contact' },
      { title: 'Календарь Runway', description: 'Изучите опубликованные показы и требования к участникам.', label: 'Посмотреть события', href: '/events' },
    ],
  },
  brand: {
    heading: 'Кабинет представителя бренда',
    description: 'Подбирайте лица для коллекции, сохраняйте портфолио и отправляйте команде запросы на сотрудничество.',
    actions: [
      { title: 'Лицо вашего проекта', description: 'Выберите модель в каталоге и отправьте запрос из её портфолио.', label: 'Подобрать модель', href: '/models' },
      { title: 'Расскажите об идее', description: 'Укажите концепцию, даты и условия: команда ответит в вашей заявке.', label: 'Отправить бриф', href: '/contact' },
    ],
  },
  agent: {
    heading: 'Кабинет представителя моделей',
    description: 'По согласованию с моделями отправляйте запросы и анкеты. Здесь хранится история заявок, отправленных из вашего аккаунта.',
    actions: [
      { title: 'Возможности для моделей', description: 'Отправьте анкету участника с его согласия и следите за её статусом.', label: 'Открыть кастинги', href: '/casting' },
      { title: 'Связь с командой', description: 'Представьте агентство, модели и условия сотрудничества в одном запросе.', label: 'Отправить запрос', href: '/contact' },
    ],
  },
  moderator: {
    heading: 'Кабинет модератора',
    description: 'Проверяйте анкеты и фотографии, принимайте решения и оставляйте ответы участникам.',
    actions: [
      { title: 'Очередь на рассмотрение', description: 'Откройте заявки участников, проверьте материалы и сохраните решение.', label: 'Открыть модерацию', href: '/admin' },
      { title: 'Публичные страницы', description: 'Просмотрите опубликованные события и условия, которые видят участники.', label: 'Посмотреть события', href: '/events' },
    ],
  },
  admin: {
    heading: 'Кабинет администратора',
    description: 'Управляйте ролями пользователей, проверяйте заявки и координируйте работу модераторов.',
    actions: [
      { title: 'Управление платформой', description: 'Назначайте роли во вкладке «Пользователи» и работайте с заявками участников.', label: 'Открыть управление', href: '/admin' },
      { title: 'Публичные страницы', description: 'Просмотрите каталог и портфолио, доступные посетителям платформы.', label: 'Открыть каталог', href: '/models' },
    ],
  },
};

function RoleActions({ user, onProfile }: { user: User; onProfile: () => void }) {
  return <section className="role-action-grid" aria-label={`Возможности аккаунта: ${ROLE_LABELS[user.role]}`}>
    {roleWorkspaces[user.role].actions.map(action => <article className="role-action-card" key={action.title}>
      <h2>{action.title}</h2><p>{action.description}</p><Link className="text-link" href={action.href}>{action.label}</Link>
    </article>)}
    <article className="role-action-card"><h2>Ваш профиль</h2><p>{user.role === 'model' ? 'Контакты, параметры и опыт помогут быстрее заполнять новые анкеты.' : 'Обновляйте свои контакты, личные данные и пароль для входа.'}</p><Button variant="text" onClick={onProfile}>Настроить профиль</Button></article>
  </section>;
}

function MemberAccount({ user }: { user: User }) {
  const router = useRouter();
  const { logout, refresh } = useSession();
  const [records, setRecords] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState(0);
  const [filters, setFilters] = useState({ ...defaultApplicationFilters });
  const [detail, setDetail] = useState<Application | null>(null);
  const [editing, setEditing] = useState<Application | null>(null);
  const [withdraw, setWithdraw] = useState<Application | null>(null);
  const [withdrawError, setWithdrawError] = useState('');
  const favoritesState = useModelFavorites();
  const favorites = favoritesState.ids;
  const workspace = roleWorkspaces[user.role];
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
  const filtered = filterApplications(records, filters);
  return <><div className="page-heading"><p className="eyebrow">MY RUNWAY / {workspace.heading}</p><h1>Привет, {user.name.split(' ')[0]}.</h1><p>{workspace.description}</p></div><div className="account-toolbar"><span className="tag">{ROLE_LABELS[user.role]}</span><div className="form-action-row">{canModerate(user.role) && <Link className="text-link" href="/admin">Управление заявками <Arrow /></Link>}<Button onClick={() => void signOut()} disabled={busy}>Выйти из аккаунта</Button></div></div>{error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}{message && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setMessage('')}>{message}</Alert>}<RoleActions user={user} onProfile={() => setTab(2)} /><Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="scrollable" allowScrollButtonsMobile aria-label="Разделы кабинета" sx={{ borderBottom: '1px solid #d8d8d0', mb: 4 }}><Tab id="account-tab-0" aria-controls="account-panel-0" label={`Мои заявки (${records.length})`} /><Tab id="account-tab-1" aria-controls="account-panel-1" label={`Избранное (${favorites.length})`} /><Tab id="account-tab-2" aria-controls="account-panel-2" label="Профиль" /></Tabs>
  <section role="tabpanel" id={`account-panel-${tab}`} aria-labelledby={`account-tab-${tab}`}>
    {tab === 0 && <><ApplicationFilterControls applications={records} value={filters} onChange={setFilters} count={filtered.length} loading={loading} /><Button sx={{ mb: 2 }} variant="outlined" onClick={() => void reload()} disabled={loading}>Обновить</Button>{loading ? <div aria-busy="true" aria-label="Загрузка заявок"><Skeleton height={90} /><Skeleton height={90} /></div> : !records.length ? <div className="empty-state"><p className="eyebrow">ВСЁ ЕЩЁ ВПЕРЕДИ</p><h2>Первая возможность уже ждёт.</h2><p>{workspace.actions[0].description}</p><Link className="button button-dark" href={workspace.actions[0].href}>{workspace.actions[0].label} <Arrow /></Link></div> : !filtered.length ? <div className="empty-state"><h2>Ничего не найдено.</h2><p>Попробуйте другой запрос или сбросьте фильтры.</p><Button onClick={() => { setFilters({ ...defaultApplicationFilters }); }}>Сбросить фильтры</Button></div> : filtered.map(item => <article className="account-record" key={item.id}><div><p className="eyebrow">{APPLICATION_TYPE_LABELS[item.type]} / {item.reference}</p><h3><button className="record-title-button" onClick={() => setDetail(item)}>{item.title} <Arrow /></button></h3><p>{formatTimestamp(item.createdAt)}{item.updatedAt !== item.createdAt && ` · Обновлена: ${formatTimestamp(item.updatedAt)}`}</p>{applicationEditReason(item) && <p className="application-edit-reason">{applicationEditReason(item)}</p>}</div><div className="record-actions"><StatusChip status={item.status} /><Button size="small" onClick={() => setDetail(item)}>Подробности</Button>{canEditApplication(item) && <Button size="small" variant="outlined" onClick={() => { setMessage(''); setEditing(item); }}>Редактировать</Button>}{!['withdrawn', 'rejected'].includes(item.status) && <Button size="small" color="inherit" onClick={() => { setWithdrawError(''); setWithdraw(item); }}>Отозвать</Button>}</div></article>)}</>}
    {tab === 1 && <>{favoritesState.error && <Alert severity="error" action={<Button onClick={() => favoritesState.retry()}>Повторить</Button>}>{favoritesState.error}</Alert>}{favoritesState.loading ? <Skeleton height={250} /> : (favorites.length ? <div className="row g-4">{models.filter(model => favorites.includes(model.id)).map(model => <div className="col-12 col-sm-6 col-lg-4" key={model.id}><ModelCard model={model} /></div>)}</div> : <div className="empty-state"><h2>Сохраните то, что вдохновляет.</h2><p>Нажмите сердце в каталоге — портфолио появится здесь и сохранится в вашем аккаунте.</p><Link href="/models" className="button button-dark">Каталог моделей <Arrow /></Link></div>)}</>}
    {tab === 2 && <><div className="profile-application-access"><h2>Поданные заявки</h2><p>Откройте заявку, чтобы изменить данные и фотографии. Сохранённая анкета поможет заполнить следующие заявки того же типа.</p><Button variant="outlined" onClick={() => setTab(0)}>Редактировать мои заявки</Button></div><ProfileEditor user={user} /></>}
  </section><ApplicationEditor application={editing} onClose={() => setEditing(null)} onSaved={updated => { setRecords(old => old.map(item => item.id === updated.id ? updated : item)); if (detail?.id === updated.id) setDetail(updated); setEditing(null); setFilters({ ...defaultApplicationFilters }); setMessage(`Заявка ${updated.reference} обновлена и отправлена на повторное рассмотрение. Анкета сохранена для следующих заявок этого типа.`); }} /><ApplicationDetails application={detail} onClose={() => setDetail(null)} /><Dialog open={!!withdraw} onClose={() => !busy && setWithdraw(null)} aria-labelledby="withdraw-title"><DialogTitle id="withdraw-title">Отозвать заявку?</DialogTitle><DialogContent>{withdrawError && <Alert severity="error" sx={{ mb: 2 }}>{withdrawError}</Alert>}<DialogContentText>Заявка «{withdraw?.title}» перестанет участвовать в отборе. Она останется в вашей истории со статусом «Отозвана».</DialogContentText></DialogContent><DialogActions><Button onClick={() => setWithdraw(null)} disabled={busy}>Оставить заявку</Button><Button onClick={() => void withdrawApplication()} disabled={busy} variant="contained">{busy ? 'Отзываем…' : 'Отозвать'}</Button></DialogActions></Dialog></>;
}
export function Account() { return <main id="main-content" className="page-shell account-section"><SessionGate>{user => <MemberAccount key={`${user.id}:${user.role}`} user={user} />}</SessionGate></main>; }
