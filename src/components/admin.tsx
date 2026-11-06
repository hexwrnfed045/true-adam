'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Skeleton, Tab, Tabs, TextField } from '@mui/material';
import type { Application, ApplicationStatus, User, UserRole } from '@/types/api';
import { api, ApiError, jsonRequest } from '@/lib/client-api';
import { APPLICATION_STATUS_LABELS, APPLICATION_TYPE_LABELS } from '@/lib/validation';
import { SessionGate } from './account';
import { ApplicationDetails, formatTimestamp, StatusChip } from './application-details';
import { useSession } from './session-provider';
import { Arrow } from './site-shell';
import './forms.css';

function AdminWorkspace({ user }: { user: User }) {
  const { refresh } = useSession();
  const [applications, setApplications] = useState<Application[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [roleError, setRoleError] = useState('');
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [detail, setDetail] = useState<Application | null>(null);
  const [review, setReview] = useState<Application | null>(null);
  const [decision, setDecision] = useState<ApplicationStatus>('reviewing');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [roleChange, setRoleChange] = useState<{ user: User; role: UserRole } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api<{ applications: Application[] }>('/api/admin/applications', { signal: controller.signal }), api<{ users: User[] }>('/api/admin/users', { signal: controller.signal })]).then(([data, people]) => { setApplications(data.applications); setUsers(people.users); }).catch(problem => { if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : 'Не удалось открыть управление.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user.id]);
  async function reload() {
    setLoading(true); setError('');
    try { const [data, people] = await Promise.all([api<{ applications: Application[] }>('/api/admin/applications'), api<{ users: User[] }>('/api/admin/users')]); setApplications(data.applications); setUsers(people.users); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Не удалось загрузить данные.'); if (problem instanceof ApiError && [401, 403].includes(problem.status)) await refresh(); }
    finally { setLoading(false); }
  }
  async function saveReview() {
    if (!review || busy) return;
    setReviewError('');
    setBusy(true); setError(''); setMessage('');
    try { const data = await jsonRequest<{ application: Application }>(`/api/admin/applications/${review.id}`, 'PATCH', { status: decision, note }); setApplications(old => old.map(item => item.id === data.application.id ? data.application : item)); if (detail?.id === data.application.id) setDetail(data.application); setReview(null); setMessage(`Решение по ${data.application.reference} сохранено.`); }
    catch (problem) { setReviewError(problem instanceof Error ? problem.message : 'Не удалось сохранить решение.'); }
    finally { setBusy(false); }
  }
  async function saveRole() {
    if (!roleChange || busy) return;
    setRoleError('');
    setBusy(true); setError(''); setMessage('');
    try { const data = await jsonRequest<{ user: User }>(`/api/admin/users/${roleChange.user.id}`, 'PATCH', { role: roleChange.role }); setUsers(old => old.map(item => item.id === data.user.id ? data.user : item)); setRoleChange(null); setMessage('Права доступа обновлены.'); if (data.user.id === user.id) await refresh(); }
    catch (problem) { setRoleError(problem instanceof Error ? problem.message : 'Не удалось изменить права.'); }
    finally { setBusy(false); }
  }
  const filtered = applications.filter(item => (status === 'all' || item.status === status) && (type === 'all' || item.type === type) && `${item.name} ${item.email} ${item.title} ${item.reference}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
  const filteredUsers = users.filter(item => `${item.name} ${item.email} ${item.city}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
  return <><div className="page-heading"><p className="eyebrow">RUNWAY / КОМАНДА АГЕНТСТВА</p><h1>За кулисами.</h1><p>Заявки, фотографии, решения и доступ сотрудников — в одном рабочем пространстве.</p></div><div className="admin-stat-grid">{[['Всего заявок', applications.length], ['Новые', applications.filter(item => item.status === 'submitted').length], ['На рассмотрении', applications.filter(item => item.status === 'reviewing').length], ['Принятые', applications.filter(item => item.status === 'accepted').length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="account-toolbar"><Link className="text-link" href="/account">Мой кабинет <Arrow /></Link><Button onClick={() => void reload()} disabled={loading}>Обновить данные</Button></div>{error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}{message && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setMessage('')}>{message}</Alert>}<Tabs value={tab} onChange={(_, value: number) => { setTab(value); setQuery(''); }} aria-label="Разделы управления" sx={{ borderBottom: '1px solid #d8d8d0', mb: 3 }}><Tab id="admin-tab-0" aria-controls="admin-panel-0" label={`Заявки (${applications.length})`} /><Tab id="admin-tab-1" aria-controls="admin-panel-1" label={`Пользователи (${users.length})`} /></Tabs><section role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}><div className="admin-filters"><TextField size="small" label={tab === 0 ? 'Имя, email, проект или номер' : 'Найти пользователя'} value={query} onChange={event => setQuery(event.target.value)} />{tab === 0 && <><TextField select size="small" label="Статус" value={status} onChange={event => setStatus(event.target.value)}><MenuItem value="all">Все статусы</MenuItem>{Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField><TextField select size="small" label="Тип заявки" value={type} onChange={event => setType(event.target.value)}><MenuItem value="all">Все типы</MenuItem>{Object.entries(APPLICATION_TYPE_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField></>}</div>{loading ? <div aria-busy="true"><Skeleton height={90} /><Skeleton height={90} /><Skeleton height={90} /></div> : tab === 0 ? filtered.length ? filtered.map(item => <article className="account-record admin-record" key={item.id}><div><p className="eyebrow">{item.reference} / {APPLICATION_TYPE_LABELS[item.type]}</p><h2><button className="record-title-button" onClick={() => setDetail(item)}>{item.title} <Arrow /></button></h2><p><strong>{item.name}</strong> · {item.city} · {item.email}</p><p>{formatTimestamp(item.createdAt)}{item.photos.length ? ` · ${item.photos.length} фото` : ''}</p></div><div className="record-actions"><StatusChip status={item.status} /><Button size="small" onClick={() => setDetail(item)}>Открыть анкету</Button>{item.status !== 'withdrawn' && <Button size="small" variant="outlined" onClick={() => { setReviewError(''); setReview(item); setDecision(item.status === 'submitted' ? 'reviewing' : item.status); setNote(item.adminNote); }}>Рассмотреть</Button>}</div></article>) : <div className="empty-state"><h2>{applications.length ? 'Заявки не найдены.' : 'Новых анкет пока нет.'}</h2><p>{applications.length ? 'Измените запрос или фильтры.' : 'После отправки участниками заявки появятся здесь.'}</p>{applications.length > 0 && <Button onClick={() => { setQuery(''); setStatus('all'); setType('all'); }}>Сбросить фильтры</Button>}</div> : filteredUsers.length ? filteredUsers.map(person => <article className="account-record admin-user" key={person.id}><div><h2>{person.name}{person.id === user.id ? ' · вы' : ''}</h2><p>{person.email} · {person.city}</p><p>Зарегистрирован: {formatTimestamp(person.createdAt)}</p></div><div className="record-actions"><span className="tag">{person.role === 'admin' ? 'Администратор' : 'Участник'}</span><Button size="small" variant="outlined" onClick={() => { setRoleError(''); setRoleChange({ user: person, role: person.role === 'admin' ? 'member' : 'admin' }); }}>{person.role === 'admin' ? 'Снять права' : 'Назначить администратором'}</Button></div></article>) : <div className="empty-state"><h2>Пользователи не найдены.</h2><Button onClick={() => setQuery('')}>Сбросить поиск</Button></div>}</section><ApplicationDetails application={detail} onClose={() => setDetail(null)} /><Dialog open={!!review} onClose={() => !busy && setReview(null)} fullWidth maxWidth="sm" aria-labelledby="review-title"><DialogTitle id="review-title">Рассмотрение {review?.reference}</DialogTitle><DialogContent>{reviewError && <Alert severity="error" sx={{ mb: 2 }}>{reviewError}</Alert>}<p className="muted">{review?.name} · {review?.title}</p><div className="application-form"><TextField select label="Решение" value={decision} onChange={event => setDecision(event.target.value as ApplicationStatus)} disabled={busy}>{(['reviewing', 'accepted', 'rejected', 'waiting'] as ApplicationStatus[]).map(value => <MenuItem key={value} value={value}>{APPLICATION_STATUS_LABELS[value]}</MenuItem>)}</TextField><TextField label="Ответ участнику" value={note} onChange={event => setNote(event.target.value)} multiline minRows={4} slotProps={{ htmlInput: { maxLength: 2000 } }} helperText="Комментарий увидит автор заявки." disabled={busy} /></div></DialogContent><DialogActions><Button onClick={() => setReview(null)} disabled={busy}>Отмена</Button><Button variant="contained" onClick={() => void saveReview()} disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить решение'}</Button></DialogActions></Dialog><Dialog open={!!roleChange} onClose={() => !busy && setRoleChange(null)} aria-labelledby="role-title"><DialogTitle id="role-title">{roleChange?.role === 'admin' ? 'Назначить администратора?' : 'Снять права администратора?'}</DialogTitle><DialogContent>{roleError && <Alert severity="error" sx={{ mb: 2 }}>{roleError}</Alert>}<p>{roleChange?.user.name} · {roleChange?.user.email}</p><p>{roleChange?.role === 'admin' ? 'Администратор получает доступ к анкетам, фотографиям и управлению пользователями.' : 'Пользователь сможет работать только со своим профилем и заявками.'}</p></DialogContent><DialogActions><Button disabled={busy} onClick={() => setRoleChange(null)}>Отмена</Button><Button disabled={busy} variant="contained" onClick={() => void saveRole()}>{busy ? 'Сохраняем…' : 'Подтвердить'}</Button></DialogActions></Dialog></>;
}
export function Admin() { return <main id="main-content" className="page-shell account-section"><SessionGate admin>{user => <AdminWorkspace key={user.id} user={user} />}</SessionGate></main>; }
