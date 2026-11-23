"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { Dialog, Fade, IconButton, useMediaQuery } from "@mui/material";
import { useSession } from "@/components/session-provider";
import { syncFavoriteSession } from "@/components/models/favorite-store";
import { ROLE_LABELS, canModerate } from "@/lib/roles";
import SiteSearch from "./site-search";
import "./site-shell.css";

type NavigationLink = { href: string; label: string };

const discoverLinks: NavigationLink[] = [
  { href: "/", label: "Главная" },
  { href: "/models", label: "Модели" },
  { href: "/events", label: "События и показы" },
  { href: "/shoots", label: "Съёмки" },
  { href: "/backstage", label: "Backstage" },
];

const participateLinks: NavigationLink[] = [
  { href: "/casting", label: "Кастинги" },
  { href: "/academy", label: "Академия" },
  { href: "/contact", label: "Сотрудничество" },
];

function Wordmark({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/" className="runway-wordmark" aria-label="Runway Models — главная" onClick={onClick}>
      RUNWAY <span>MODELS</span>
    </Link>
  );
}

export function Arrow({ diagonal = true }: { diagonal?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={diagonal ? "M5 19 19 5M5 5h14v14" : "M4 12h16m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  const currentPath = pathname.replace(/\/+$/, "") || "/";
  const { user, loading } = useSession();
  const userId = user?.id ?? null;
  const [open, setOpen] = useState(false);
  const [menuMotion, setMenuMotion] = useState("closed");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const menuTiming = reducedMotion ? 0 : { enter: 620, exit: 280 };

  useEffect(() => {
    if (!loading) syncFavoriteSession(userId);
  }, [userId, loading]);

  const active = (href: string) => href === "/"
    ? currentPath === "/"
    : currentPath === href || currentPath.startsWith(href + "/");
  const closeMenu = () => { setMenuMotion("exiting"); setOpen(false); };
  const accountLinks: NavigationLink[] = user || loading
    ? [{ href: "/account", label: "Кабинет" }]
    : [{ href: "/login", label: "Войти" }, { href: "/register", label: "Регистрация" }];
  if (user && canModerate(user.role)) {
    accountLinks.push({ href: "/admin", label: user.role === "admin" ? "Управление" : "Модерация" });
  }
  const navigationGroups = [
    { title: "Разделы", links: discoverLinks },
    { title: "Участие", links: [...participateLinks, ...accountLinks] },
  ];

  return (
    <header className={`runway-shell-header${currentPath === "/" ? " runway-shell-header--landing" : ""}`}>
      <div className="runway-shell-header-inner">
        <Wordmark />
        <div className="runway-shell-header-actions">
          <SiteSearch />
          <button
            type="button"
            className="runway-menu-trigger"
            onClick={() => { setMenuMotion("entering"); setOpen(true); }}
            aria-expanded={open}
            aria-controls={open ? "runway-menu-dialog" : undefined}
            aria-haspopup="dialog"
          >
            <span>Меню</span>
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden="true">
              <path d="M1 4h20M1 12h20" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={closeMenu}
        fullWidth
        maxWidth={false}
        slots={{ transition: Fade }}
        transitionDuration={menuTiming}
        data-menu-motion={menuMotion}
        className="runway-shell-menu"
        aria-labelledby="runway-menu-title"
        slotProps={{
          paper: { id: "runway-menu-dialog" },
          backdrop: { transitionDuration: menuTiming },
          transition: {
            onEnter: () => setMenuMotion("entering"),
            onEntered: () => setMenuMotion("entered"),
            onExit: () => setMenuMotion("exiting"),
            onExited: () => setMenuMotion("closed"),
          },
        }}
      >
        <div className="runway-menu-inner">
          <div className="runway-menu-top">
            <Wordmark onClick={closeMenu} />
            <IconButton autoFocus className="runway-menu-close" onClick={closeMenu} aria-label="Закрыть меню">
              <span>Закрыть</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m3 3 14 14M3 17 17 3" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </IconButton>
          </div>

          <h2 id="runway-menu-title" className="runway-menu-caption">Навигация / Runway Models</h2>
          <nav className="runway-menu-grid" aria-label="Все разделы сайта">
            {navigationGroups.map((group, groupIndex) => (
              <div className="runway-menu-group" key={group.title}>
                <p className="runway-menu-group-title">{group.title}</p>
                <ul>
                  {group.links.map(({ href, label }, linkIndex) => (
                    <li key={href} style={{ "--menu-item-index": groupIndex * 3 + linkIndex } as CSSProperties}>
                      <Link href={href} onClick={closeMenu} aria-current={active(href) ? "page" : undefined}>
                        <span>{label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="runway-menu-utilities">
            {user ? <p>{user.name} / {ROLE_LABELS[user.role]}</p> : <Link href="/account" onClick={closeMenu}>Личный кабинет</Link>}
            <Link href="/privacy" onClick={closeMenu}>Данные и конфиденциальность</Link>
          </div>
        </div>
      </Dialog>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="runway-shell-footer">
      <div className="runway-footer-inner">
        <div className="runway-footer-main">
          <Wordmark />
          <nav aria-label="Навигация в подвале">
            <Link href="/models">Модели</Link>
            <Link href="/events">События</Link>
            <Link href="/contact">Сотрудничество</Link>
            <Link href="/account">Кабинет</Link>
          </nav>
        </div>
        <div className="runway-footer-utilities">
          <p>© {new Date().getFullYear()} Runway Models</p>
          <Link href="/privacy">Данные и конфиденциальность</Link>
        </div>
      </div>
    </footer>
  );
}
