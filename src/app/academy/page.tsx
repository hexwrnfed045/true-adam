import type { Metadata } from "next";
import { connection } from "next/server";
import Academy from "@/components/events/Academy";
import { getToday } from "@/data/events";

export const metadata: Metadata = { title: "Академия", description: "Дефиле, позирование и работа перед камерой. Программы Runway Academy для вашего первого шага." };

export default async function AcademyPage() {
  await connection();
  return <Academy today={getToday()} />;
}
