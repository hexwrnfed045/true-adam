import type { Metadata } from "next";
import { connection } from "next/server";
import EventsExplorer from "@/components/events/EventsExplorer";
import { getToday } from "@/data/events";

export const metadata: Metadata = { title: "Показы и календарь", description: "Календарь показов, съёмок и кастингов Runway Models. Найдите событие в своём городе." };

export default async function EventsPage() {
  await connection();
  return <EventsExplorer today={getToday()} />;
}
