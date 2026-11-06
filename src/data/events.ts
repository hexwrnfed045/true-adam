export interface RunwayEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  city: string;
  venue: string;
  type: "Показ" | "Кастинг" | "Съёмка";
  image: string;
  openToPublic: boolean;
  status: "Открыт набор" | "Закрыто" | "Отменено" | "Завершено";
  description: string;
  requirements: string[];
  deadline: string;
  organizer: string;
  seats: number;
}

/** Fictional editorial events for the frontend demonstration. */
export const events: RunwayEvent[] = [
  { id: "new-perspective", title: "NEW PERSPECTIVE", date: "2026-11-14", time: "19:00", city: "Алматы", venue: "Пространство Atelier, зал 01", type: "Показ", image: "/images/hero-runway.jpg", openToPublic: true, status: "Открыт набор", description: "Новый сезон. Новые имена. Вечер независимой моды, где строгие силуэты встречаются со свободой самовыражения. В программе — три коллекции и разговор с их авторами после показа.", requirements: ["Модели от 18 лет, рост от 175 см", "Портфолио и базовые навыки дефиле", "Примерка 12 ноября, репетиция 14 ноября в 15:00"], deadline: "2026-11-08", organizer: "Runway Creative Team", seats: 48 },
  { id: "quiet-form", title: "QUIET FORM", date: "2026-11-28", time: "18:30", city: "Астана", venue: "Studio 17, основной зал", type: "Показ", image: "/images/editorial-01.jpg", openToPublic: true, status: "Открыт набор", description: "Исследование формы, света и движения. Камерный показ минималистичных коллекций, созданных для города. Образы объединяет сдержанная палитра и внимание к деталям.", requirements: ["Модели от 18 лет, рост от 173 см", "Опыт показов приветствуется", "Обязательное участие в примерке 27 ноября"], deadline: "2026-11-20", organizer: "Studio 17", seats: 32 },
  { id: "after-hours", title: "AFTER HOURS", date: "2026-12-12", time: "20:00", city: "Алматы", venue: "Black Box, подиумный зал", type: "Показ", image: "/images/backstage-01.jpg", openToPublic: true, status: "Открыт набор", description: "Ночной город как источник вдохновения. Финальный показ сезона о выразительности, характере и смелых пропорциях. После дефиле пространство превращается в открытую выставку образов.", requirements: ["Модели от 18 лет", "Уверенное дефиле и готовность к вечерней репетиции", "Портфолио: портрет, полный рост, профиль"], deadline: "2026-12-04", organizer: "Black Box Collective", seats: 60 },
  { id: "fresh-faces", title: "FRESH FACES / 2026", date: "2026-11-07", time: "12:00", city: "Алматы", venue: "Runway Studio, зал 02", type: "Кастинг", image: "/images/model-01.jpg", openToPublic: false, status: "Открыт набор", description: "Открываем новые лица для проектов зимнего сезона. На кастинге познакомимся, сделаем снэпы и посмотрим короткое дефиле. Профессиональное портфолио для первого знакомства не обязательно.", requirements: ["Возраст от 18 лет", "Нейтральная облегающая одежда без принтов", "Естественный макияж или без макияжа", "Возьмите обувь для дефиле"], deadline: "2026-11-05", organizer: "Runway Models", seats: 0 },
  { id: "monochrome-stories", title: "MONOCHROME STORIES", date: "2026-11-19", time: "10:00", city: "Алматы", venue: "Daylight Studio", type: "Съёмка", image: "/images/editorial-01.jpg", openToPublic: false, status: "Открыт набор", description: "Editorial-съёмка о пластике, естественном свете и индивидуальности. Чёрно-белая история для портфолио. Команда предоставляет стилиста и визажиста, готовые фотографии передаются участникам.", requirements: ["Модели от 18 лет, любой типаж", "Готовность к съёмке в течение 4 часов", "Условия TFP: участие без гонорара, 8 готовых кадров в портфолио"], deadline: "2026-11-12", organizer: "Atelier Photo Team", seats: 0 },
  { id: "city-in-motion", title: "CITY IN MOTION", date: "2026-11-25", time: "09:00", city: "Астана", venue: "Локации в центре города", type: "Съёмка", image: "/images/model-04.jpg", openToPublic: false, status: "Закрыто", description: "Коммерческая съёмка городской коллекции. Динамичные кадры на улицах и в архитектурных пространствах. Команда уже сформирована; заявки на этот проект закрыты.", requirements: ["Опыт коммерческих съёмок", "Съёмочная смена до 8 часов", "Гонорар и права использования согласуются индивидуально"], deadline: "2026-10-25", organizer: "Motion Production", seats: 0 },
  { id: "winter-silhouettes", title: "WINTER SILHOUETTES", date: "2026-12-05", time: "18:00", city: "Астана", venue: "Gallery Space", type: "Показ", image: "/images/academy-01.jpg", openToPublic: false, status: "Отменено", description: "Показ зимней коллекции отменён организатором. Приём заявок и зрительская запись остановлены. Новый проект будет опубликован отдельно в календаре.", requirements: ["Мероприятие отменено"], deadline: "2026-11-20", organizer: "Gallery Space", seats: 0 },
  { id: "first-light", title: "FIRST LIGHT", date: "2026-10-17", time: "17:00", city: "Алматы", venue: "Runway Studio", type: "Показ", image: "/images/backstage-01.jpg", openToPublic: false, status: "Завершено", description: "Осенний показ дебютных коллекций. Встреча нового поколения дизайнеров и моделей, завершившая октябрьскую программу Runway. Событие прошло; новые заявки не принимаются.", requirements: ["Мероприятие завершено"], deadline: "2026-10-10", organizer: "Runway Models", seats: 0 },
];

export const EVENT_TIME_ZONE = "Asia/Qyzylorda";

/** Current calendar date in the platform's timezone; safe in both server and client code. */
export function getToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** Effective status also accounts for dates, instead of relying on a stale editorial label. */
export function getEventStatus(event: RunwayEvent, today = getToday()): RunwayEvent["status"] {
  if (event.status === "Отменено") return "Отменено";
  if (event.status === "Завершено" || event.date < today) return "Завершено";
  if (event.status === "Закрыто" || event.deadline < today) return "Закрыто";
  return "Открыт набор";
}

export function isEventAvailable(event: RunwayEvent, today = getToday()) {
  return getEventStatus(event, today) === "Открыт набор";
}

export function isViewerRegistrationAvailable(event: RunwayEvent, today = getToday()) {
  return isEventAvailable(event, today) && event.type === "Показ" && event.openToPublic && event.seats > 0;
}

export function formatEventDate(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", options ?? { day: "numeric", month: "long" });
}
