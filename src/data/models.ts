export type Model = {
  id: string;
  name: string;
  city: string;
  height: number;
  specialty: string;
  image: string;
  measurements: string;
  shoe: number;
  hair: string;
  eyes: string;
  experience: string;
  gallery: string[];
};

/** Fictional profiles and illustrative stock photography for the frontend demo. */
export const models: Model[] = [
  { id: "arman-kim", name: "Арман Ким", city: "Алматы", height: 188, specialty: "Runway", image: "/images/model-01.jpg", measurements: "94 / 76 / 94", shoe: 43, hair: "Тёмные", eyes: "Карие", experience: "Демо-профиль подиумной модели. Направления: показы мужских коллекций, fashion-съёмки и тесты для портфолио.", gallery: ["/images/model-01.jpg", "/images/editorial-01.jpg"] },
  { id: "eva-sokolova", name: "Ева Соколова", city: "Астана", height: 178, specialty: "Editorial", image: "/images/model-02.jpg", measurements: "84 / 62 / 90", shoe: 39, hair: "Каштановые", eyes: "Карие", experience: "Демо-профиль fashion-модели. Направления: редакционные истории, beauty и работа перед камерой.", gallery: ["/images/model-02.jpg", "/images/editorial-01.jpg"] },
  { id: "daniel-lee", name: "Даниэль Ли", city: "Алматы", height: 186, specialty: "Commercial", image: "/images/model-04.jpg", measurements: "92 / 74 / 93", shoe: 42, hair: "Тёмные", eyes: "Карие", experience: "Демо-профиль коммерческой модели. Направления: кампании брендов, lookbook и lifestyle-проекты.", gallery: ["/images/model-04.jpg", "/images/backstage-01.jpg"] },
  { id: "aya-nur", name: "Ая Нур", city: "Алматы", height: 176, specialty: "Runway", image: "/images/model-03.jpg", measurements: "82 / 60 / 88", shoe: 38, hair: "Тёмные", eyes: "Карие", experience: "Демо-профиль подиумной модели. Направления: дефиле, дизайнерские коллекции и fashion-портфолио.", gallery: ["/images/model-03.jpg", "/images/editorial-01.jpg"] },
  { id: "mark-ivanov", name: "Марк Иванов", city: "Астана", height: 190, specialty: "Editorial", image: "/images/model-05.jpg", measurements: "96 / 78 / 96", shoe: 44, hair: "Русые", eyes: "Серые", experience: "Демо-профиль editorial-модели. Направления: концептуальные съёмки, мужская мода и lookbook.", gallery: ["/images/model-05.jpg", "/images/backstage-01.jpg"] },
  { id: "milan-aslan", name: "Милан Аслан", city: "Шымкент", height: 184, specialty: "Commercial", image: "/images/model-06.jpg", measurements: "92 / 75 / 93", shoe: 42, hair: "Тёмные", eyes: "Карие", experience: "Демо-профиль коммерческой модели. Направления: рекламные проекты, beauty и съёмки коллекций.", gallery: ["/images/model-06.jpg", "/images/editorial-01.jpg"] },
];
