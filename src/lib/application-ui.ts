import type { Application, ApplicationStatus, ApplicationType, User } from '../types/api';

export function applicationDefaults(user: User, applications: Application[], type: ApplicationType): Record<string, string> {
  const personal = applications
    .filter(item => item.userId === user.id && item.type !== 'collaboration')
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  const history = type === 'collaboration'
    ? applications.filter(item => item.userId === user.id && item.type === type)
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
    : personal;
  const model = personal.find(item => item.type === 'model');
  const measurements = model?.measurements.match(/\d+/g) ?? [];
  return {
    name: user.name,
    city: user.city,
    phone: history.find(item => item.phone)?.phone ?? '',
    age: String(personal.find(item => item.age != null)?.age ?? ''),
    height: String(model?.height ?? ''),
    chest: measurements[0] ?? '',
    waist: measurements[1] ?? '',
    hips: measurements[2] ?? '',
    description: type === 'model' || type === 'course'
      ? personal.find(item => item.type === type)?.description ?? ''
      : '',
  };
}

export interface ApplicationFilters {
  query: string;
  type: ApplicationType | 'all';
  status: ApplicationStatus | 'all';
  city: string;
  project: string;
  sort: 'newest' | 'oldest' | 'name' | 'age-asc' | 'age-desc';
}

export const defaultApplicationFilters: ApplicationFilters = {
  query: '', type: 'all', status: 'all', city: '', project: '', sort: 'newest',
};

export function filterApplications(applications: Application[], filters: ApplicationFilters) {
  const query = filters.query.trim().toLocaleLowerCase('ru');
  return applications.filter(item =>
    (filters.type === 'all' || item.type === filters.type) &&
    (filters.status === 'all' || item.status === filters.status) &&
    (!filters.city || item.city === filters.city) &&
    (!filters.project || `${item.type}:${item.targetId ?? ''}` === filters.project) &&
    `${item.name} ${item.email} ${item.phone} ${item.city} ${item.title} ${item.reference}`.toLocaleLowerCase('ru').includes(query)
  ).sort((a, b) => {
    const newest = b.createdAt.localeCompare(a.createdAt);
    switch (filters.sort) {
      case 'oldest': return -newest;
      case 'name': return a.name.localeCompare(b.name, 'ru') || newest;
      case 'age-asc':
      case 'age-desc':
        // Older course applications may have no age. Keep them at the end in either direction.
        if (a.age == null) return b.age == null ? newest : 1;
        if (b.age == null) return -1;
        return (filters.sort === 'age-asc' ? a.age - b.age : b.age - a.age) || newest;
      default: return newest;
    }
  });
}
