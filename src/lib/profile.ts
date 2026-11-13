import { getToday } from "../data/events.ts";
import { isValidDate } from "./validation.ts";

export function calculateAge(birthDate?: string | null, today = getToday()): number | null {
  if (!birthDate || !isValidDate(birthDate) || birthDate.startsWith("0000-") || !isValidDate(today) || birthDate > today) {
    return null;
  }
  const years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return today.slice(5) < birthDate.slice(5) ? years - 1 : years;
}
