import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateAge } from '../src/lib/profile.ts';
import {
  isValidDate,
  validateApplicationFields,
  validateLogin,
  validatePasswordChange,
  validateProfile,
  validateRegister,
} from '../src/lib/validation.ts';
import {
  events,
  getEventStatus,
  getToday,
  isEventAvailable,
  isViewerRegistrationAvailable,
} from '../src/data/events.ts';

// These modules contain only pure functions. Node 24 strips their TypeScript
// annotations directly; no Next server, compiled copy, or database is involved.
const requestKey = '87b73e58-8ab7-4d78-9bb6-22f8c4b87a81';
function application(overrides = {}) {
  return {
    type: 'viewer',
    targetId: 'new-perspective',
    name: '  Ирина Тестовая  ',
    email: '  MEMBER@EXAMPLE.TEST  ',
    city: '  Алматы  ',
    phone: '+7 (700) 123-45-67',
    consent: 'true',
    idempotencyKey: requestKey,
    ...overrides,
  };
}
function model(overrides = {}) {
  return application({ type: 'model', age: '22', height: '180', measurements: '90/60/90', ...overrides });
}
function expectFields(input, fields) {
  const result = validateApplicationFields(input);
  assert.equal(result.value, null, 'invalid input must not produce a usable application');
  for (const field of fields) assert.ok(result.fieldErrors[field], `expected an error for ${field}`);
}
function event(overrides = {}) {
  return {
    ...events[0],
    date: '2030-05-20',
    deadline: '2030-05-15',
    status: 'Открыт набор',
    type: 'Показ',
    openToPublic: true,
    seats: 2,
    ...overrides,
  };
}

describe('account validation', () => {
  it('normalizes registration identity and defaults to the viewer role', () => {
    const result = validateRegister({ name: '  Ирина Тестовая  ', city: '  Алматы  ', email: '  MEMBER@EXAMPLE.TEST  ', password: 'long password 123', consent: true });
    assert.deepEqual(result.fieldErrors, {});
    assert.equal(result.value.name, 'Ирина Тестовая');
    assert.equal(result.value.city, 'Алматы');
    assert.equal(result.value.email, 'member@example.test');
    assert.equal(result.value.role, 'viewer');
  });

  it('accepts each public account type and rejects staff or unknown registration roles', () => {
    const input = { name: 'Ирина Тестовая', city: 'Алматы', email: 'member@example.test', password: 'long password 123', consent: true };
    for (const role of ['viewer', 'model', 'organizer', 'brand', 'agent']) {
      const result = validateRegister({ ...input, role });
      assert.deepEqual(result.fieldErrors, {}, role);
      assert.equal(result.value.role, role);
    }
    for (const role of ['admin', 'moderator', 'guest', 'member', 'unknown', null, [], {}]) {
      const result = validateRegister({ ...input, role });
      assert.equal(result.value, null, JSON.stringify(role));
      assert.ok(result.fieldErrors.role, JSON.stringify(role));
    }
  });

  it('requires a real consent boolean, usable identity, valid email, and an adequate password', () => {
    const result = validateRegister({ name: '   ', city: ' ', email: 'invalid', password: 'short', consent: 'true' });
    assert.equal(result.value, null);
    for (const field of ['name', 'city', 'email', 'password', 'consent']) assert.ok(result.fieldErrors[field]);
  });

  it('does not expose profile privilege fields and enforces the server city limit', () => {
    assert.deepEqual(validateProfile({ name: 'Member', city: 'Almaty', role: 'admin', email: ' REPLACEMENT@EXAMPLE.TEST ' }).value, { name: 'Member', city: 'Almaty', email: 'replacement@example.test' });
    const invalid = validateProfile({ name: 'Member', city: 'x'.repeat(81) });
    assert.equal(invalid.value, null);
    assert.ok(invalid.fieldErrors.city);
  });

  it('normalizes login email and rejects an empty or excessive password', () => {
    assert.deepEqual(validateLogin({ email: '  MEMBER@EXAMPLE.TEST ', password: 'a password' }).value, { email: 'member@example.test', password: 'a password' });
    for (const password of ['', 'a'.repeat(129)]) {
      const invalid = validateLogin({ email: 'member@example.test', password });
      assert.equal(invalid.value, null);
      assert.ok(invalid.fieldErrors.password);
    }
  });

  it('requires a different valid password when changing credentials', () => {
    assert.ok(validatePasswordChange({ currentPassword: 'old password 123', newPassword: 'new password 456' }).value);
    for (const newPassword of ['old password 123', 'short', 'a'.repeat(129)]) {
      const invalid = validatePasswordChange({ currentPassword: 'old password 123', newPassword });
      assert.equal(invalid.value, null);
      assert.ok(invalid.fieldErrors.newPassword);
    }
    assert.ok(validatePasswordChange({ currentPassword: '', newPassword: 'new password 456' }).fieldErrors.currentPassword);
  });
});

describe('application field contracts', () => {
  it('accepts viewer records without requesting model measurements', () => {
    const result = validateApplicationFields(application());
    assert.deepEqual(result.fieldErrors, {});
    assert.equal(result.value.type, 'viewer');
    assert.equal(result.value.name, 'Ирина Тестовая');
    assert.equal(result.value.email, 'member@example.test');
    assert.equal(result.value.age, null);
    assert.equal(result.value.height, null);
    assert.equal(result.value.measurements, '');
  });

  it('accepts a model application with the form age, height, and combined body measurements', () => {
    const result = validateApplicationFields(model({ chest: '90', waist: '60', hips: '90' }));
    assert.ok(result.value, JSON.stringify(result.fieldErrors));
    assert.equal(result.value.age, 22);
    assert.equal(result.value.height, 180);
    assert.equal(result.value.measurements, '90/60/90');
    assert.equal(Object.hasOwn(result.value, 'chest'), false);
  });

  it('rejects underage, non-integral age, and invalid model height', () => {
    for (const age of ['17', '18.5', '81', 'not-a-number']) expectFields(model({ age }), ['age']);
    for (const height of ['139', '221', '180.5', 'Infinity']) expectFields(model({ height }), ['height']);
  });

  it('requires all three sensible model measurements rather than arbitrary text', () => {
    for (const measurements of ['', '90/60', '90/20/90', '90/60/200', 'medium', '90.5/60/90']) {
      expectFields(model({ measurements }), ['measurements']);
    }
  });

  it('accepts course enrollment without unrelated model or collaboration fields', () => {
    const result = validateApplicationFields(application({ type: 'course', targetId: 'runway-basics' }));
    assert.ok(result.value, JSON.stringify(result.fieldErrors));
    assert.equal(result.value.targetId, 'runway-basics');
    assert.equal(result.value.modelId, null);
    assert.equal(result.value.height, null);
    assert.equal(result.value.projectDate, '');
  });

  it('accepts the projectDate/projectType collaboration form contract', () => {
    const result = validateApplicationFields(application({ type: 'collaboration', targetId: '', modelId: 'model-reference', projectDate: '2030-11-20', projectType: 'Editorial', description: 'Editorial shoot with a confirmed team and budget.' }));
    assert.ok(result.value, JSON.stringify(result.fieldErrors));
    assert.equal(result.value.targetId, null);
    assert.equal(result.value.modelId, 'model-reference');
    assert.equal(result.value.projectDate, '2030-11-20');
    assert.equal(result.value.projectType, 'Editorial');
  });

  it('rejects incomplete collaboration briefs and impossible calendar dates', () => {
    expectFields(application({ type: 'collaboration', targetId: '', description: 'short', projectDate: '2030-02-30', projectType: 'unknown' }), ['description', 'projectDate', 'projectType']);
  });

  it('rejects punctuation-only or malformed phones instead of counting their characters', () => {
    for (const phone of ['-------', '123456', '1234567890123456', '+7 700 abc 45 67']) expectFields(application({ phone }), ['phone']);
  });

  it('validates consent, request IDs, reference syntax, and description limits', () => {
    expectFields(application({ consent: 'false', idempotencyKey: 'retry-1', targetId: '../../private', modelId: 'not/a/model', description: 'x'.repeat(2001) }), ['consent', 'idempotencyKey', 'targetId', 'modelId', 'description']);
    expectFields(application({ type: 'admin' }), ['type']);
  });
});

describe('calendar dates and Kazakhstan timezone', () => {
  it('accepts leap days only in leap years and rejects date rollover', () => {
    for (const value of ['2028-02-29', '2026-11-06', '2030-12-31']) assert.equal(isValidDate(value), true, value);
    for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-11-00', '2026-1-01', '2026-11-06T00:00:00Z', 'not-a-date']) assert.equal(isValidDate(value), false, value);
  });

  it('changes the platform date at local UTC+5 midnight, independent of host timezone', () => {
    assert.equal(getToday(new Date('2026-11-05T18:59:59.999Z')), '2026-11-05');
    assert.equal(getToday(new Date('2026-11-05T19:00:00.000Z')), '2026-11-06');
    assert.equal(getToday(new Date('2026-12-31T19:00:00.000Z')), '2027-01-01');
  });

  it('keeps an application deadline inclusive, then closes it before the event date', () => {
    assert.equal(isEventAvailable(event(), '2030-05-15'), true);
    assert.equal(isEventAvailable(event(), '2030-05-16'), false);
    assert.equal(getEventStatus(event(), '2030-05-16'), 'Закрыто');
  });

  it('marks past events complete even if editorial status still says open', () => {
    const past = event({ deadline: '2030-05-30' });
    assert.equal(getEventStatus(past, '2030-05-21'), 'Завершено');
    assert.equal(isEventAvailable(past, '2030-05-21'), false);
  });

  it('preserves manual closed, completed, and cancelled states without reopening them', () => {
    for (const status of ['Закрыто', 'Завершено', 'Отменено']) {
      assert.equal(getEventStatus(event({ status }), '2030-05-10'), status);
      assert.equal(isEventAvailable(event({ status }), '2030-05-10'), false);
    }
    assert.equal(getEventStatus(event({ status: 'Отменено' }), '2030-06-01'), 'Отменено');
  });

  it('offers spectator registration only on available public shows with capacity', () => {
    assert.equal(isViewerRegistrationAvailable(event(), '2030-05-10'), true);
    for (const overrides of [{ openToPublic: false }, { seats: 0 }, { type: 'Кастинг' }, { type: 'Съёмка' }, { status: 'Отменено' }]) {
      assert.equal(isViewerRegistrationAvailable(event(overrides), '2030-05-10'), false, JSON.stringify(overrides));
    }
    assert.equal(isViewerRegistrationAvailable(event(), '2030-05-16'), false);
  });
});
import { applicationDefaults, defaultApplicationFilters, filterApplications } from '../src/lib/application-ui.ts';

describe('application autofill and list controls', () => {
  const user = { id: 'member', name: 'Имя из профиля', city: 'Алматы' };
  const records = [
    { id: 'old-model', userId: user.id, type: 'model', createdAt: '2026-01-01', name: 'Анна', city: 'Алматы', phone: '+77001111111', age: 25, height: 180, measurements: '90 / 60 / 90', description: 'Опыт модели', status: 'submitted', targetId: null, title: 'Анкета', reference: 'RW-1', email: 'a@example.test' },
    { id: 'new-course', userId: user.id, type: 'course', createdAt: '2026-02-01', name: 'Борис', city: 'Астана', phone: '+77002222222', age: null, height: null, measurements: '', description: 'Хочу изучить подиум', status: 'accepted', targetId: 'course-one', title: 'Курс', reference: 'RW-2', email: 'b@example.test' },
    { id: 'other-model', userId: 'another-user', type: 'model', createdAt: '2026-03-01', name: 'Вера', city: 'Алматы', phone: '+77009999999', age: 21, height: 175, measurements: '85/60/90', description: 'Чужая анкета', status: 'submitted', targetId: 'event-one', title: 'Показ', reference: 'RW-3', email: 'v@example.test' },
  ];

  it('uses the current profile and the latest personal data of the same user', () => {
    const defaults = applicationDefaults(user, records, 'model');
    assert.equal(defaults.name, user.name);
    assert.equal(defaults.city, user.city);
    assert.equal(defaults.phone, '+77002222222');
    assert.equal(defaults.age, '25');
    assert.equal(defaults.height, '180');
    assert.deepEqual([defaults.chest, defaults.waist, defaults.hips], ['90', '60', '90']);
    assert.equal(defaults.description, 'Опыт модели');
    assert.equal(applicationDefaults(user, records, 'course').description, 'Хочу изучить подиум');
  });

  it('handles first applications and keeps project descriptions out of personal forms', () => {
    assert.equal(applicationDefaults(user, [], 'model').age, '');
    const collaboration = { ...records[0], type: 'collaboration', createdAt: '2027-01-01', phone: '+77008888888', description: 'Бюджет проекта' };
    assert.equal(applicationDefaults(user, [...records, collaboration], 'model').phone, '+77002222222');
    assert.equal(applicationDefaults(user, [...records, collaboration], 'collaboration').description, '');
  });

  it('combines type, status, city, project and case-insensitive search', () => {
    const filtered = filterApplications(records, { ...defaultApplicationFilters, type: 'course', status: 'accepted', city: 'Астана', project: 'course:course-one', query: '  БОРИС ' });
    assert.deepEqual(filtered.map(item => item.id), ['new-course']);
    assert.equal(filterApplications(records, { ...defaultApplicationFilters, type: 'model', project: 'course:course-one' }).length, 0);
    assert.equal(filterApplications(records, defaultApplicationFilters).length, records.length);
  });

  it('sorts without mutating the source and puts missing ages last in either direction', () => {
    const ids = sort => filterApplications(records, { ...defaultApplicationFilters, sort }).map(item => item.id);
    assert.deepEqual(ids('age-asc'), ['other-model', 'old-model', 'new-course']);
    assert.deepEqual(ids('age-desc'), ['old-model', 'other-model', 'new-course']);
    assert.deepEqual(ids('newest'), ['other-model', 'new-course', 'old-model']);
    assert.deepEqual(ids('oldest'), ['old-model', 'new-course', 'other-model']);
    assert.deepEqual(ids('name'), ['old-model', 'new-course', 'other-model']);
    assert.equal(records[0].id, 'old-model');
  });
});

describe('profile birth date and application autofill', () => {
  it('increments age on the birthday and rejects impossible or future dates', () => {
    assert.equal(calculateAge('2000-11-13', '2026-11-12'), 25);
    assert.equal(calculateAge('2000-11-13', '2026-11-13'), 26);
    assert.equal(calculateAge('2000-02-29', '2026-02-28'), 25);
    assert.equal(calculateAge('2000-02-29', '2026-03-01'), 26);
    for (const date of ['', '2001-02-29', '2026-11-14', '13.11.2000']) {
      assert.equal(calculateAge(date, '2026-11-13'), null);
    }
  });

  it('takes saved details and current age from the profile before looking at old applications', () => {
    const user = {
      id: 'owner', name: 'Member', city: 'Almaty', phone: '+77001112233',
      birthDate: '2000-11-13', height: 179, chest: 92, waist: 65, hips: 91, experience: 'New experience',
    };
    const oldApplication = {
      userId: user.id, type: 'model', createdAt: '2025-10-01', age: 24, height: 170,
      measurements: '86/63/88', phone: '+77009998877', description: 'Old experience',
    };
    const defaults = applicationDefaults(user, [oldApplication], 'model', '2026-11-13');
    assert.deepEqual(defaults, {
      name: user.name, city: user.city, phone: user.phone, age: '26',
      height: '179', chest: '92', waist: '65', hips: '91', description: user.experience,
    });
    assert.equal(applicationDefaults(user, [], 'course', '2026-11-12').age, '25');
  });
});
