'use client';

import { Button, MenuItem, TextField } from '@mui/material';
import type { Application } from '@/types/api';
import { APPLICATION_STATUS_LABELS, APPLICATION_TYPE_LABELS } from '@/lib/validation';
import { defaultApplicationFilters, type ApplicationFilters } from '@/lib/application-ui';

export function ApplicationFilterControls({ applications, value, onChange, count, loading }: {
  applications: Application[];
  value: ApplicationFilters;
  onChange: (value: ApplicationFilters) => void;
  count: number;
  loading: boolean;
}) {
  const cities = [...new Set(applications.map(item => item.city))].sort((a, b) => a.localeCompare(b, 'ru'));
  const projects = new Map(applications
    .filter(item => value.type === 'all' || item.type === value.type)
    .map(item => [`${item.type}:${item.targetId ?? ''}`, item.title]));

  return <>
    <div className="application-list-filters">
      <TextField size="small" label="Имя, email, проект или номер" value={value.query}
        onChange={event => onChange({ ...value, query: event.target.value })} />
      <TextField select size="small" label="Тип заявки" value={value.type}
        onChange={event => onChange({ ...value, type: event.target.value as ApplicationFilters['type'], project: '' })}>
        <MenuItem value="all">Все типы</MenuItem>
        {Object.entries(APPLICATION_TYPE_LABELS).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}
      </TextField>
      <TextField select size="small" label="Статус" value={value.status}
        onChange={event => onChange({ ...value, status: event.target.value as ApplicationFilters['status'] })}>
        <MenuItem value="all">Все статусы</MenuItem>
        {Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}
      </TextField>
      <TextField select size="small" label="Город" value={value.city}
        onChange={event => onChange({ ...value, city: event.target.value })}>
        <MenuItem value="">Все города</MenuItem>
        {cities.map(city => <MenuItem key={city} value={city}>{city}</MenuItem>)}
      </TextField>
      <TextField select size="small" label="Курс или событие" value={value.project}
        onChange={event => onChange({ ...value, project: event.target.value })}>
        <MenuItem value="">Все проекты</MenuItem>
        {[...projects].map(([key, title]) => <MenuItem key={key} value={key}>{title}</MenuItem>)}
      </TextField>
      <TextField select size="small" label="Сортировка" value={value.sort}
        onChange={event => onChange({ ...value, sort: event.target.value as ApplicationFilters['sort'] })}>
        <MenuItem value="newest">Сначала новые</MenuItem>
        <MenuItem value="oldest">Сначала старые</MenuItem>
        <MenuItem value="name">По имени, А–Я</MenuItem>
        <MenuItem value="age-asc">Возраст по возрастанию</MenuItem>
        <MenuItem value="age-desc">Возраст по убыванию</MenuItem>
      </TextField>
    </div>
    <div className="application-filter-summary">
      <span role="status">{loading ? 'Загрузка заявок…' : `Найдено ${count} из ${applications.length}`}</span>
      <Button onClick={() => onChange({ ...defaultApplicationFilters })}>Сбросить фильтры</Button>
    </div>
  </>;
}
