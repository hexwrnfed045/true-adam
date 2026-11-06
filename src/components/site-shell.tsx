"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Drawer, IconButton } from "@mui/material";
import { useSession } from "@/components/session-provider";
import { syncFavoriteSession } from "@/components/models/favorite-store";

const links = [
  ["/models", "Модели"], ["/events", "Показы"], ["/shoots", "Съёмки"],
  ["/casting", "Кастинги"], ["/academy", "Академия"], ["/backstage", "Backstage"],
];

export function Arrow({ diagonal = true }: { diagonal?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? "M5 19 19 5M5 5h14v14" : "M4 12h16m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.4" /></svg>;
}

export function Header() {
  const pathname = usePathname();
  const { user, loading } = useSession();
  const userId = user?.id ?? null;
  useEffect(() => { if (!loading) syncFavoriteSession(userId); }, [userId, loading]);
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const accountLabel = user ? `Личный кабинет: ${user.name}` : "Войти в личный кабинет";

  return <header className="site-header">
    <Link href="/" className="brand" aria-label="Runway Models — главная">RUNWAY<span>MODELS <i aria-hidden="true" /></span></Link>
    <nav className="desktop-nav" aria-label="Основная навигация">
      {links.map(([href, label]) => <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined}>{label}</Link>)}
    </nav>
    <div className="header-actions">
      <Link className="account-link" href="/account" aria-label={accountLabel} title={accountLabel} aria-current={isActive("/account") ? "page" : undefined}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.5" stroke="currentColor" /><path d="M5 21v-3a7 7 0 0 1 14 0v3" stroke="currentColor" /></svg>
        {user && <span className="account-session-dot" aria-hidden="true" />}
      </Link>
      <Link href="/casting" className="header-cta">Стать моделью <Arrow /></Link>
      <IconButton type="button" className="mobile-menu" aria-label="Открыть меню" aria-expanded={open} aria-controls={open ? "mobile-navigation" : undefined} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7h18M3 16h18" stroke="currentColor" /></svg>
      </IconButton>
    </div>
    <Drawer anchor="right" open={open} onClose={() => setOpen(false)} slotProps={{ paper: { role: "dialog", "aria-modal": true, "aria-labelledby": "mobile-nav-title" } }}>
      <div className="mobile-drawer" id="mobile-navigation">
        <div className="d-flex justify-content-between align-items-center"><span className="eyebrow" id="mobile-nav-title">Runway Models — меню</span><IconButton type="button" onClick={() => setOpen(false)} aria-label="Закрыть меню">×</IconButton></div>
        <nav aria-label="Мобильная навигация">
          {[["/", "Главная"], ...links, ["/contact", "Сотрудничество"], ["/account", user ? "Мой кабинет" : "Вход / регистрация"]].map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={isActive(href) ? "page" : undefined}>{label}<Arrow /></Link>)}
        </nav>
      </div>
    </Drawer>
  </header>;
}

export function Footer() {
  return <footer className="site-footer">
    <div className="footer-top"><div><p className="eyebrow">Следующая глава начинается с тебя</p><Link className="footer-call" href="/casting">LET’S WALK.<Arrow /></Link></div><Link className="button button-light" href="/contact">Для брендов и фотографов <Arrow /></Link></div>
    <div className="footer-bottom">
      <Link href="/" className="brand" aria-label="Runway Models — главная">RUNWAY<span>MODELS <i aria-hidden="true" /></span></Link>
      <nav className="footer-links" aria-label="Навигация в подвале"><Link href="/models">Модели</Link><Link href="/events">События</Link><Link href="/academy">Обучение</Link><Link href="/contact">Контакты</Link><Link href="/account">Кабинет</Link><Link href="/privacy">Конфиденциальность</Link></nav>
      <p>© {new Date().getFullYear()} Runway Models<br /><span>Runway Models · независимая модельная платформа</span></p>
    </div>
  </footer>;
}
