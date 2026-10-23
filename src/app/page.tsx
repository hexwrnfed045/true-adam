export default function Home() {
  return (
    <main className="runway-page">
      <header className="runway-header">
        <span className="runway-wordmark">RM.</span>
        <span>Показы / Люди / Движение</span>
        <a href="#directions">О проекте ↗</a>
      </header>
      <section className="runway-hero" aria-labelledby="runway-title">
        <p className="runway-label">Новый взгляд на модельную индустрию</p>
        <h1 id="runway-title">RUNWAY<br /><span>MODELS</span></h1>
        <div className="runway-intro">
          <span className="runway-label">От первого шага<br />до большого подиума</span>
          <p>Место, где встречаются модели, мода и новые возможности.</p>
        </div>
      </section>
      <section id="directions" className="runway-directions" aria-label="Направления проекта">
        {[
          ["01", "Показы", "Даты, места и события мира моды."],
          ["02", "Съёмки", "Проекты, лица и новые истории в кадре."],
          ["03", "Кастинги", "Возможность сделать свой первый шаг."],
          ["04", "Обучение", "Дефиле, позирование и работа перед камерой."],
        ].map(([number, title, description]) => (
          <article key={number} className="runway-direction">
            <span className="runway-label">/{number}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>
      <footer className="runway-footer">
        <span>Runway Models</span>
        <span>Сайт в разработке</span>
      </footer>
    </main>
  );
}
