import type { RunwayEvent } from "@/data/events";

function escapeCalendarText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

// RFC 5545 limits content lines to 75 UTF-8 octets, including the continuation space.
function foldCalendarLine(value: string) {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let line = "";
  let bytes = 0;
  for (const character of value) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) {
      lines.push(line);
      line = " ";
      bytes = 1;
    }
    line += character;
    bytes += length;
  }
  lines.push(line);
  return lines.join("\r\n");
}

function calendarTimestamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Dates in the editorial calendar are Kazakhstan local time, UTC+5. */
export function buildEventCalendar(selected: readonly RunwayEvent[], generatedAt = new Date()) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Runway Models//Editorial Calendar//RU", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Runway Models"];
  for (const event of selected) {
    const startsAt = new Date(`${event.date}T${event.time}:00+05:00`);
    if (!Number.isFinite(startsAt.getTime())) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@runway-models.local`,
      `DTSTAMP:${calendarTimestamp(generatedAt)}`,
      `DTSTART:${calendarTimestamp(startsAt)}`,
      `SUMMARY:${escapeCalendarText(event.title)}`,
      `LOCATION:${escapeCalendarText(`${event.city}, ${event.venue}`)}`,
      `DESCRIPTION:${escapeCalendarText(`${event.type}. ${event.description}\nОрганизатор: ${event.organizer}.\nРедакционное событие Runway Models. Сохранение даты не является записью или подтверждением участия.`)}`,
      `STATUS:${event.status === "Отменено" ? "CANCELLED" : "TENTATIVE"}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldCalendarLine).join("\r\n")}\r\n`;
}
