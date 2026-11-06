'use client';
import Image from 'next/image';
import { Chip, Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';
import type { Application, ApplicationStatus } from '@/types/api';
import { APPLICATION_STATUS_LABELS, APPLICATION_TYPE_LABELS } from '@/lib/validation';

export function StatusChip({ status }: { status: ApplicationStatus }) {
  const color = status === 'accepted' ? 'success' : status === 'rejected' ? 'error' : status === 'reviewing' || status === 'waiting' ? 'warning' : 'default';
  return <Chip size="small" variant="outlined" color={color} label={APPLICATION_STATUS_LABELS[status]} />;
}
export function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Qyzylorda' });
}
export function ApplicationDetails({ application, onClose }: { application: Application | null; onClose: () => void }) {
  if (!application) return null;
  const fields = [
    ['Номер', application.reference], ['Тип', APPLICATION_TYPE_LABELS[application.type]],
    ['Имя / бренд', application.name], ['Email', application.email], ['Телефон', application.phone], ['Город', application.city],
    ...(application.type === 'model' ? [['Возраст', `${application.age} лет`], ['Рост', `${application.height} см`], ['Грудь / талия / бёдра', `${application.measurements} см`]] : []),
    ...(application.type === 'collaboration' ? [['Формат проекта', application.projectType], ['Дата проекта', application.projectDate]] : []),
    ['Отправлена', formatTimestamp(application.createdAt)],
  ];
  return <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="application-detail-title" slotProps={{ paper: { className: 'application-detail-dialog' } }}><DialogTitle id="application-detail-title" className="detail-dialog-heading"><span>{application.title}</span><IconButton onClick={onClose} aria-label="Закрыть анкету">×</IconButton></DialogTitle><DialogContent><div className="detail-status-row"><StatusChip status={application.status} /><span className="eyebrow">{application.reference}</span></div><dl className="application-detail-fields">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Не указано'}</dd></div>)}</dl>{application.description && <section className="detail-text"><h3>Комментарий к заявке</h3><p>{application.description}</p></section>}{application.adminNote && <section className="detail-text team-note"><h3>Ответ команды</h3><p>{application.adminNote}</p></section>}{application.photos.length > 0 && <section className="detail-text"><h3>Фотографии</h3><div className="application-photo-grid">{application.photos.map(photo => <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" aria-label={`Открыть фото ${photo.name} в полном размере`}><div><Image unoptimized src={photo.url} alt={photo.name} fill sizes="(max-width:600px) 42vw, 240px" /></div><span>{photo.name} ↗</span></a>)}</div></section>}{!!application.history?.length && <section className="detail-text"><h3>История рассмотрения</h3><ol className="application-history">{application.history.map((item, index) => <li key={`${item.at}-${index}`}><strong>{APPLICATION_STATUS_LABELS[item.status]}</strong><time dateTime={item.at}>{formatTimestamp(item.at)}</time>{item.note && <p>{item.note}</p>}</li>)}</ol></section>}</DialogContent></Dialog>;
}
