import type { Application } from '../types/api.ts';
import { events, getToday, isEventAvailable, isViewerRegistrationAvailable } from '../data/events.ts';
import { courses, isCourseAvailable } from '../data/courses.ts';

export function applicationEditReason(application: Application, today = getToday()): string | null {
  if (application.status === 'withdrawn') return 'Отозванную заявку нельзя редактировать. Подайте новую заявку.';
  if (application.type === 'model' && !application.targetId) return null;
  if (application.type === 'collaboration') {
    return application.projectDate >= today ? null : 'Дата проекта уже прошла. Создайте новый запрос на сотрудничество.';
  }
  if (application.type === 'course') {
    const course = courses.find(item => item.id === application.targetId);
    return course && isCourseAvailable(course, today) ? null : 'Курс уже начался или запись на него закрыта.';
  }
  const event = events.find(item => item.id === application.targetId);
  if (!event || !isEventAvailable(event, today)) return 'Приём заявок на это событие закрыт.';
  if (application.type === 'viewer' && !isViewerRegistrationAvailable(event, today)) return 'Зрительская запись на это событие недоступна.';
  return null;
}

export function canEditApplication(application: Application, today = getToday()) {
  return applicationEditReason(application, today) === null;
}
