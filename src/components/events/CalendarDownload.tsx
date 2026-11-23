"use client";

import { useState } from "react";
import type { RunwayEvent } from "@/data/events";
import { buildEventCalendar } from "./calendar-export";

export default function CalendarDownload({ events, filename = "runway-events", label = "В календарь (.ics)", className = "" }: {
  events: RunwayEvent[];
  filename?: string;
  label?: string;
  className?: string;
}) {
  const [message, setMessage] = useState("");
  function download() {
    try {
      const file = new Blob([buildEventCalendar(events)], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${filename.replace(/[^a-z0-9-]/gi, "-")}.ics`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Файл календаря скачан. Откройте его в приложении календаря.");
    } catch {
      setMessage("Не удалось скачать файл. Повторите попытку.");
    }
  }
  return <div className={`calendar-download ${className}`}><button type="button" className="calendar-download-button" onClick={download} disabled={!events.length} aria-label={`${label}. Событий: ${events.length}`}>{label}<span aria-hidden="true">↓</span></button>{message && <p className="calendar-download-message" role="status">{message}</p>}</div>;
}
