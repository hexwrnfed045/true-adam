import type { Application, ApplicationType, User } from '../types/api';

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
