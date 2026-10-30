import type { Metadata } from "next";
import EventsExplorer from "@/components/events/EventsExplorer";

export const metadata: Metadata = { title: "Показы и календарь", description: "Календарь показов, съёмок и кастингов Runway Models. Найдите событие в своём городе." };

export default function EventsPage() { return <EventsExplorer />; }
