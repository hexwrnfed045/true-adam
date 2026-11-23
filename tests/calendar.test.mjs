import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildEventCalendar } from '../src/components/events/calendar-export.ts';

const generatedAt = new Date('2026-11-23T09:00:00.000Z');
function event(overrides = {}) {
  return {
    id: 'calendar-reference',
    title: 'RUNWAY / NEW SEASON',
    date: '2030-12-12',
    time: '19:00',
    city: 'Алматы',
    venue: 'Подиум, зал 01',
    type: 'Показ',
    image: '/images/hero-runway.jpg',
    openToPublic: true,
    status: 'Открыт набор',
    description: 'Редакционная история нового сезона.',
    requirements: [],
    deadline: '2030-12-04',
    organizer: 'Runway Models',
    seats: 48,
    ...overrides,
  };
}
function unfold(calendar) {
  return calendar.replace(/\r\n[ \t]/g, '');
}

describe('iCalendar export', () => {
  it('converts Kazakhstan UTC+5 start times across midnight and year boundaries', () => {
    const calendar = unfold(buildEventCalendar([
      event({ id: 'midnight', time: '00:30' }),
      event({ id: 'new-year', date: '2031-01-01', time: '01:00' }),
    ], generatedAt));
    assert.ok(calendar.includes('DTSTART:20301211T193000Z\r\n'));
    assert.ok(calendar.includes('DTSTART:20301231T200000Z\r\n'));
    assert.ok(calendar.includes('DTSTAMP:20261123T090000Z\r\n'));
  });

  it('escapes text delimiters and line breaks instead of injecting calendar properties', () => {
    const calendar = unfold(buildEventCalendar([event({
      title: 'Тест, образ; движение\\свет',
      venue: 'Зал, 01; этаж 2',
      description: 'Первая строка\r\nBEGIN:VEVENT\nВторая строка, точка;',
    })], generatedAt));
    assert.ok(calendar.includes('SUMMARY:Тест\\, образ\\; движение\\\\свет\r\n'));
    assert.ok(calendar.includes('LOCATION:Алматы\\, Зал\\, 01\\; этаж 2\r\n'));
    assert.ok(calendar.includes('Первая строка\\nBEGIN:VEVENT\\nВторая строка\\, точка\\;'));
    assert.equal(calendar.split('\r\n').filter(line => line === 'BEGIN:VEVENT').length, 1);
  });

  it('folds long UTF-8 text to 75-byte physical lines without losing characters', () => {
    const title = 'Новая глава — выразительность, движение и характер ✨ '.repeat(10);
    const calendar = buildEventCalendar([event({ title })], generatedAt);
    assert.ok(calendar.includes('\r\n '), 'long text should use continuation lines');
    for (const line of calendar.split('\r\n')) {
      assert.ok(Buffer.byteLength(line, 'utf8') <= 75, 'a physical line exceeds 75 octets');
      assert.ok(!line.includes('\uFFFD'), 'UTF-8 characters must stay intact');
    }
    const escapedTitle = title.replaceAll(',', '\\,');
    assert.ok(unfold(calendar).includes(`SUMMARY:${escapedTitle}\r\n`));
  });

  it('exports separate stable events with CRLF framing and the correct cancellation state', () => {
    const calendar = unfold(buildEventCalendar([
      event({ id: 'first' }),
      event({ id: 'cancelled', status: 'Отменено' }),
    ], generatedAt));
    assert.ok(calendar.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
    assert.ok(calendar.endsWith('END:VCALENDAR\r\n'));
    assert.ok(!calendar.replaceAll('\r\n', '').includes('\n'), 'bare line feeds are not valid framing');
    assert.equal(calendar.split('\r\n').filter(line => line === 'BEGIN:VEVENT').length, 2);
    assert.equal(calendar.split('\r\n').filter(line => line === 'END:VEVENT').length, 2);
    assert.ok(calendar.includes('UID:first@runway-models.local\r\n'));
    assert.ok(calendar.includes('UID:cancelled@runway-models.local\r\n'));
    assert.ok(calendar.includes('STATUS:TENTATIVE\r\n'));
    assert.ok(calendar.includes('STATUS:CANCELLED\r\n'));
  });

  it('does not invent an end time or confirmation and supports an empty selection', () => {
    const calendar = unfold(buildEventCalendar([event()], generatedAt));
    assert.ok(!calendar.includes('DTEND:'));
    assert.ok(!calendar.includes('DURATION:'));
    assert.ok(!calendar.includes('STATUS:CONFIRMED'));
    assert.ok(calendar.includes('Сохранение даты не является записью или подтверждением участия.'));
    const empty = buildEventCalendar([], generatedAt);
    assert.ok(empty.startsWith('BEGIN:VCALENDAR\r\n'));
    assert.ok(empty.endsWith('END:VCALENDAR\r\n'));
    assert.ok(!empty.includes('BEGIN:VEVENT'));
  });
});
