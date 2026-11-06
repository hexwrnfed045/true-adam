import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
  it('normalizes registration identity and email without accepting an injected role', () => {
    const result = validateRegister({ name: '  Ирина Тестовая  ', city: '  Алматы  ', email: '  MEMBER@EXAMPLE.TEST  ', password: 'long password 123', consent: true, role: 'admin' });
    assert.deepEqual(result.fieldErrors, {});
    assert.equal(result.value.name, 'Ирина Тестовая');
    assert.equal(result.value.city, 'Алматы');
    assert.equal(result.value.email, 'member@example.test');
    assert.equal(Object.hasOwn(result.value, 'role'), false);
  });

  it('requires a real consent boolean, usable identity, valid email, and an adequate password', () => {
    const result = validateRegister({ name: '   ', city: ' ', email: 'invalid', password: 'short', consent: 'true' });
    assert.equal(result.value, null);
    for (const field of ['name', 'city', 'email', 'password', 'consent']) assert.ok(result.fieldErrors[field]);
  });

  it('does not expose profile privilege fields and enforces the server city limit', () => {
    assert.deepEqual(validateProfile({ name: 'Member', city: 'Almaty', role: 'admin', email: 'replacement@example.test' }).value, { name: 'Member', city: 'Almaty' });
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
