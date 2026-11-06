'use client';
import Link from 'next/link';
import '@/components/forms.css';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content" className="page-shell gated-page"><p className="eyebrow">RUNWAY / ОШИБКА ЗАГРУЗКИ</p><h1>Попробуем ещё раз.</h1><p>Страницу не удалось загрузить. Повторите запрос или вернитесь на главную.</p><div className="form-action-row"><button className="button button-dark" onClick={reset}>Повторить ↻</button><Link className="text-link" href="/">На главную ↗</Link></div></main>;
}
