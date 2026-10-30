import type { Metadata } from "next";
import Academy from "@/components/events/Academy";

export const metadata: Metadata = { title: "Академия", description: "Дефиле, позирование и работа перед камерой. Программы Runway Academy для вашего первого шага." };

export default function AcademyPage() { return <Academy />; }
