'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Skeleton, Tab, Tabs, TextField } from '@mui/material';
import type { Application, ApplicationStatus, User, UserRole } from '@/types/api';
import { ACCOUNT_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/lib/roles';
import { api, ApiError, jsonRequest } from '@/lib/client-api';
import { APPLICATION_STATUS_LABELS, APPLICATION_TYPE_LABELS } from '@/lib/validation';
import { SessionGate } from './account';
import { ApplicationDetails, formatTimestamp, StatusChip } from './application-details';
import { useSession } from './session-provider';
import { ApplicationFilterControls } from './application-filters';
import { defaultApplicationFilters, filterApplications } from '@/lib/application-ui';
import { Arrow } from './site-shell';
import './forms.css';

function AdminWorkspace({ user }: { user: User }) {
  const { refresh } = useSession();
  const isAdmin = user.role === 'admin';
  const [applications, setApplications] = useState<Application[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [roleError, setRoleError] = useState('');
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ ...defaultApplicationFilters });
  const [detail, setDetail] = useState<Application | null>(null);
  const [review, setReview] = useState<Application | null>(null);
  const [decision, setDecision] = useState<ApplicationStatus>('reviewing');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [roleChange, setRoleChange] = useState<{ user: User; role: UserRole } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api<{ applications: Application[] }>('/api/admin/applications', { signal: controller.signal }), isAdmin ? api<{ users: User[] }>('/api/admin/users', { signal: controller.signal }) : Promise.resolve({ users: [] as User[] })]).then(([data, people]) => { setApplications(data.applications); setUsers(people.users); }).catch(problem => { if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : 'Не удалось открыть управление.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user.id, isAdmin]);
  async function reload() {
    setLoading(true); setError('');
    try { const [data, people] = await Promise.all([api<{ applications: Application[] }>('/api/admin/applications'), isAdmin ? api<{ users: User[] }>('/api/admin/users') : Promise.resolve({ users: [] as User[] })]); setApplications(data.applications); setUsers(people.users); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Не удалось загрузить данные.'); if (problem instanceof ApiError && [401, 403].includes(problem.status)) await refresh(); }
    finally { setLoading(false); }
  }
  async function saveReview() {
    if (!review || busy) return;
    setReviewError('');
    setBusy(true); setError(''); setMessage('');
    try { const data = await jsonRequest<{ application: Application }>(`/api/admin/applications/${review.id}`, 'PATCH', { status: decision, note }); setApplications(old => old.map(item => item.id === data.application.id ? data.application : item)); if (detail?.id === data.application.id) setDetail(data.application); setReview(null); setMessage(`Решение по ${data.application.reference} сохранено.`); }
    catch (problem) { setReviewError(problem instanceof Error ? problem.message : 'Не удалось сохранить решение.'); if (problem instanceof ApiError && [401, 403].includes(problem.status)) await refresh(); }
    finally { setBusy(false); }
  }
  async function saveRole() {
    if (!isAdmin || !roleChange || busy) return;
    setRoleError('');
    setBusy(true); setError(''); setMessage('');
    try { const data = await jsonRequest<{ user: User }>(`/api/admin/users/${roleChange.user.id}`, 'PATCH', { role: roleChange.role }); setUsers(old => old.map(item => item.id === data.user.id ? data.user : item)); setRoleChange(null); setMessage('Права доступа обновлены.'); if (data.user.id === user.id) await refresh(); }
    catch (problem) { setRoleError(problem instanceof Error ? problem.message : 'Не удалось изменить права.'); if (problem instanceof ApiError && [401, 403].includes(problem.status)) await refresh(); }
    finally { setBusy(false); }
  }
  const filtered = filterApplications(applications, filters);
  const filteredUsers = users.filter(item => `${item.name} ${item.email} ${item.city} ${ROLE_LABELS[item.role]}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
  return <><div className="page-heading"><p className="eyebrow">RUNWAY / КОМАНДА АГЕНТСТВА</p><h1>{isAdmin ? 'Управление платформой.' : 'Модерация заявок.'}</h1><p>{isAdmin ? 'Заявки, фотографии, решения и роли пользователей — в одном рабочем пространстве.' : 'Проверяйте анкеты и фотографии, сохраняйте решения и отвечайте участникам.'}</p></div><div className="admin-stat-grid">{[['Всего заявок', applications.length], ['Новые', applications.filter(item => item.status === 'submitted').length], ['На рассмотрении', applications.filter(item => item.status === 'reviewing').length], ['Принятые', applications.filter(item => item.status === 'accepted').length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="account-toolbar"><span className="tag">{ROLE_LABELS[user.role]}</span><Link className="text-link" href="/account">Мой кабинет <Arrow /></Link><Button onClick={() => void reload()} disabled={loading}>Обновить данные</Button></div>{error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}{message && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setMessage('')}>{message}</Alert>}<Tabs value={tab} onChange={(_, value: number) => { setTab(value); setQuery(''); }} aria-label="Разделы управления" sx={{ borderBottom: '1px solid #d8d8d0', mb: 3 }}><Tab id="admin-tab-0" aria-controls="admin-panel-0" label={`Заявки (${applications.length})`} />{isAdmin && <Tab id="admin-tab-1" aria-controls="admin-panel-1" label={`Пользователи (${users.length})`} />}</Tabs><section role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>{tab === 0 ? <ApplicationFilterControls applications={applications} value={filters} onChange={setFilters} count={filtered.length} loading={loading} /> : <div className="admin-filters"><TextField size="small" label="Найти пользователя" value={query} onChange={event => setQuery(event.target.value)} /></div>}{loading ? <div aria-busy="true"><Skeleton height={90} /><Skeleton height={90} /><Skeleton height={90} /></div> : tab === 0 ? filtered.length ? filtered.map(item => <article className="account-record admin-record" key={item.id}><div><p className="eyebrow">{item.reference} / {APPLICATION_TYPE_LABELS[item.type]}</p><h2><button className="record-title-button" onClick={() => setDetail(item)}>{item.title} <Arrow /></button></h2><p><strong>{item.name}</strong> · {item.city} · {item.email}{item.age != null && ` · Возраст: ${item.age}`}</p><p>{formatTimestamp(item.createdAt)}{item.photos.length ? ` · ${item.photos.length} фото` : ''}</p></div><div className="record-actions"><StatusChip status={item.status} /><Button size="small" onClick={() => setDetail(item)}>Открыть анкету</Button>{item.status !== 'withdrawn' && <Button size="small" variant="outlined" onClick={() => { setReviewError(''); setReview(item); setDecision(item.status === 'submitted' ? 'reviewing' : item.status); setNote(item.adminNote); }}>Рассмотреть</Button>}</div></article>) : <div className="empty-state"><h2>{applications.length ? 'Заявки не найдены.' : 'Новых анкет пока нет.'}</h2><p>{applications.length ? 'Измените запрос или фильтры.' : 'После отправки участниками заявки появятся здесь.'}</p>{applications.length > 0 && <Button onClick={() => { setFilters({ ...defaultApplicationFilters }); }}>Сбросить фильтры</Button>}</div> : filteredUsers.length ? filteredUsers.map(person => <article className="account-record admin-user" key={person.id}><div><h2>{person.name}{person.id === user.id ? ' · вы' : ''}</h2><p>{person.email} · {person.city}</p><p>Зарегистрирован: {formatTimestamp(person.createdAt)}</p></div><div className="record-actions"><span className="tag">{ROLE_LABELS[person.role]}</span><Button size="small" variant="outlined" onClick={() => { setRoleError(''); setRoleChange({ user: person, role: person.role }); }}>Изменить роль</Button></div></article>) : <div className="empty-state"><h2>Пользователи не найдены.</h2><Button onClick={() => setQuery('')}>Сбросить поиск</Button></div>}</section><ApplicationDetails application={detail} onClose={() => setDetail(null)} /><Dialog open={!!review} onClose={() => !busy && setReview(null)} fullWidth maxWidth="sm" aria-labelledby="review-title"><DialogTitle id="review-title">Рассмотрение {review?.reference}</DialogTitle><DialogContent>{reviewError && <Alert severity="error" sx={{ mb: 2 }}>{reviewError}</Alert>}<p className="muted">{review?.name} · {review?.title}</p><div className="application-form"><TextField select label="Решение" value={decision} onChange={event => setDecision(event.target.value as ApplicationStatus)} disabled={busy}>{(['reviewing', 'accepted', 'rejected', 'waiting'] as ApplicationStatus[]).map(value => <MenuItem key={value} value={value}>{APPLICATION_STATUS_LABELS[value]}</MenuItem>)}</TextField><TextField label="Ответ участнику" value={note} onChange={event => setNote(event.target.value)} multiline minRows={4} slotProps={{ htmlInput: { maxLength: 2000 } }} helperText="Комментарий увидит автор заявки." disabled={busy} /></div></DialogContent><DialogActions><Button onClick={() => setReview(null)} disabled={busy}>Отмена</Button><Button variant="contained" onClick={() => void saveReview()} disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить решение'}</Button></DialogActions></Dialog><Dialog open={isAdmin && !!roleChange} onClose={() => !busy && setRoleChange(null)} fullWidth maxWidth="sm" aria-labelledby="role-title"><DialogTitle id="role-title">Роль пользователя</DialogTitle><DialogContent>{roleError && <Alert severity="error" sx={{ mb: 2 }}>{roleError}</Alert>}<p>{roleChange?.user.name} · {roleChange?.user.email}</p><TextField select fullWidth label="Тип аккаунта" value={roleChange?.role ?? 'viewer'} onChange={event => { setRoleError(''); setRoleChange(current => current ? { ...current, role: event.target.value as UserRole } : null); }} helperText={roleChange ? ROLE_DESCRIPTIONS[roleChange.role] : ''} disabled={busy} sx={{ mt: 2 }}>{ACCOUNT_ROLES.map(role => <MenuItem key={role} value={role}>{ROLE_LABELS[role]}</MenuItem>)}</TextField><p className="role-change-note">Изменение прав применяется сразу после сохранения. Последний администратор должен сохранить свою роль.</p></DialogContent><DialogActions><Button disabled={busy} onClick={() => setRoleChange(null)}>Отмена</Button><Button disabled={busy || roleChange?.role === roleChange?.user.role} variant="contained" onClick={() => void saveRole()}>{busy ? 'Сохраняем…' : 'Сохранить роль'}</Button></DialogActions></Dialog></>;
}
export function Admin() { return <main id="main-content" className="page-shell account-section"><SessionGate admin>{user => <AdminWorkspace key={`${user.id}:${user.role}`} user={user} />}</SessionGate></main>; }
