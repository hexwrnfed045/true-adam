import { RequestForm, FormImage } from "@/components/request-form";

export const metadata = { title: "Сотрудничество" };

export default function ContactPage() {
  return (
    <main id="main-content" className="page-shell form-page">
      <header className="page-heading">
        <h1>Сотрудничество</h1>
        <p>Запросы на съёмки, показы и подбор моделей.</p>
      </header>
      <div className="form-layout">
        <aside className="form-aside">
          <h2>О вашем проекте</h2>
          <p>Укажите город, дату и условия. Выберите модель из каталога или поручите подбор команде.</p>
          <FormImage contact />
        </aside>
        <RequestForm contact />
      </div>
    </main>
  );
}
