import type { UserRole } from "../types/api.ts";

export const ACCOUNT_ROLES = ["viewer", "model", "organizer", "brand", "agent", "moderator", "admin"] as const;
export const REGISTRATION_ROLES = ["viewer", "model", "organizer", "brand", "agent"] as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  viewer: "Зритель",
  model: "Модель",
  organizer: "Организатор",
  brand: "Представитель бренда",
  agent: "Представитель моделей",
  moderator: "Модератор",
  admin: "Администратор",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  viewer: "Сохраняйте модели в избранное, записывайтесь на открытые показы и следите за своими записями.",
  model: "Заполняйте профиль и параметры, отправляйте фотографии и заявки на кастинги, следите за решениями.",
  organizer: "Отправляйте проекты показов и съёмок на согласование и отслеживайте собственные обращения.",
  brand: "Выбирайте модели для бренда, отправляйте запросы на сотрудничество и отслеживайте ответы.",
  agent: "Подбирайте проекты для моделей и отправляйте обращения по вопросам представительства и сотрудничества.",
  moderator: "Рассматривайте заявки и фотографии, обновляйте статусы и отвечайте участникам.",
  admin: "Управляйте заявками и назначайте роли пользователям платформы.",
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (ACCOUNT_ROLES as readonly string[]).includes(value);
}

export function isRegistrationRole(value: unknown): value is typeof REGISTRATION_ROLES[number] {
  return typeof value === "string" && (REGISTRATION_ROLES as readonly string[]).includes(value);
}

export function canModerate(role: UserRole) {
  return role === "admin" || role === "moderator";
}
