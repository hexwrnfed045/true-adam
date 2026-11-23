import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { defaultEventQuery, eventDetailHref, eventQueryString, eventResultsHref, parseEventQuery, safeEventReturnTo } from '../src/components/events/event-query.ts';
const today = '2026-11-23';

describe('event search URL state', () => {
  it('round trips filters, calendar view, and a manually chosen empty month', () => {
    const state = { ...defaultEventQuery(today), q: 'AFTER HOURS', city: 'Алматы', type: 'Показ', status: 'Открыт набор', period: 'all', from: '2026-11-01', to: '2026-12-31', sort: 'desc', view: 'calendar', month: '2027-02' };
    assert.deepEqual(parseEventQuery(new URLSearchParams(eventQueryString(state, today)), today), state);
  });
  it('rejects unsupported enums, impossible dates, and malformed months', () => {
    const state = parseEventQuery(new URLSearchParams('city=unknown&type=script&status=admin&period=unknown&sort=sideways&view=unknown&from=2026-02-30&to=not-a-date&month=2026-13'), today);
    assert.deepEqual(state, defaultEventQuery(today));
  });
  it('retains a valid reversed date range so the interface can explain the error', () => {
    const state = parseEventQuery(new URLSearchParams('from=2026-12-10&to=2026-11-01'), today);
    assert.equal(state.from, '2026-12-10');
    assert.equal(state.to, '2026-11-01');
  });
  it('limits search text and discards control characters', () => {
    const state = parseEventQuery(new URLSearchParams({ q: '\u0000hello\n' + 'a'.repeat(200) }), today);
    assert.equal(state.q.length, 120);
    assert.ok(!/[\u0000-\u001f]/.test(state.q));
  });
  it('encodes a safe return destination and rejects external or unrelated destinations', () => {
    const state = { ...defaultEventQuery(today), city: 'Алматы', view: 'calendar', month: '2026-12' };
    const destination = eventResultsHref(state, today);
    const detail = eventDetailHref('after-hours', destination);
    assert.equal(new URL(detail, 'https://runway.local').searchParams.get('returnTo'), destination);
    assert.equal(safeEventReturnTo(destination, today), destination);
    for (const value of ['https://evil.test/events', '//evil.test/events', '/admin', '/events/after-hours', '/events\\evil']) assert.equal(safeEventReturnTo(value, today), '/events/');
  });
  it('strips unknown return query fields rather than propagating arbitrary parameters', () => {
    const destination = safeEventReturnTo('/events/?city=Алматы&admin=true&view=calendar&month=2026-12', today);
    assert.ok(!destination.includes('admin'));
    assert.equal(parseEventQuery(new URL(destination, 'https://runway.local').searchParams, today).month, '2026-12');
  });
});
