"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog, IconButton } from "@mui/material";
import { useSession } from "@/components/session-provider";
import { syncFavoriteSession } from "@/components/models/favorite-store";
import SiteSearch from "./site-search";
import { ROLE_LABELS, canModerate } from "@/lib/roles";

const links = [
  ["/models","Модели"], ["/events","Показы"], ["/shoots","Съёмки"],
  ["/casting","Кастинги"], ["/academy","Академия"], ["/backstage","Backstage"],
];
export function Arrow({diagonal=true}:{diagonal?:boolean}) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal?"M5 19 19 5M5 5h14v14":"M4 12h16m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.4"/></svg>;
}
export function Header() {
  const pathname=usePathname();
  const {user,loading}=useSession();
  const userId=user?.id??null;
  useEffect(()=>{if(!loading)syncFavoriteSession(userId);},[userId,loading]);
  const [open,setOpen]=useState(false);
  const active=(href:string)=>href==="/" ? pathname==="/" : pathname===href||pathname.startsWith(href+"/");
  return <header className="site-header editorial-header">
    <Link href="/" className="brand editorial-brand" aria-label="Runway Models — главная">RUNWAY<span>MODELS</span></Link>
    <nav className="editorial-desktop-nav" aria-label="Основная навигация">{links.slice(0,5).map(([href,label])=><Link key={href} href={href} aria-current={active(href)?"page":undefined}>{label}</Link>)}</nav>
    <div className="editorial-header-actions"><SiteSearch/><Link href="/account" className="editorial-account" aria-label={user?"Личный кабинет: "+user.name+", "+ROLE_LABELS[user.role]:"Войти в личный кабинет"}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.5" stroke="currentColor"/><path d="M5 21v-3a7 7 0 0 1 14 0v3" stroke="currentColor"/></svg>{user&&<span className="account-session-dot" aria-hidden="true"/>}</Link><button type="button" className="editorial-menu-trigger" onClick={()=>setOpen(true)} aria-expanded={open} aria-controls={open?"runway-menu":undefined} aria-haspopup="dialog"><span>МЕНЮ</span><span className="menu-lines" aria-hidden="true"><i/><i/></span></button></div>
    <Dialog open={open} onClose={()=>setOpen(false)} fullScreen className="editorial-menu" aria-labelledby="menu-title"><div className="editorial-menu-top"><span id="menu-title">RUNWAY / НАВИГАЦИЯ</span><IconButton onClick={()=>setOpen(false)} aria-label="Закрыть меню">×</IconButton></div><div className="editorial-menu-grid"><nav id="runway-menu" aria-label="Полная навигация">{[["/","Главная"],...links,["/contact","Сотрудничество"],...(user && canModerate(user.role) ? [["/admin",user.role === "admin" ? "Управление" : "Модерация"]] : []),["/account",user?"Мой кабинет · "+ROLE_LABELS[user.role]:"Вход / регистрация"]].map(([href,label])=><Link key={href} href={href} onClick={()=>setOpen(false)} aria-current={active(href)?"page":undefined}>{label}</Link>)}</nav><div className="editorial-menu-photo"><Image src="/images/model-03.jpg" alt="Редакционный портрет Runway" fill sizes="40vw"/><span>YOUR NEXT CHAPTER.</span></div></div><div className="editorial-menu-bottom"><span>ALMATY / ASTANA</span><Link href="/privacy" onClick={()=>setOpen(false)}>Конфиденциальность</Link></div></Dialog>
  </header>;
}
export function Footer() {
  return <footer className="site-footer editorial-footer"><div className="editorial-footer-top"><Link className="editorial-footer-call" href="/casting">YOUR NEXT<br /><em>CHAPTER.</em></Link><div><p>Новые лица. Новые истории.<br />Следующая может быть твоей.</p><Link href="/casting" className="editorial-link">Оставить анкету</Link></div></div><div className="editorial-footer-bottom"><Link href="/" className="brand editorial-brand" aria-label="Runway Models — главная">RUNWAY<span>MODELS</span></Link><nav aria-label="Навигация в подвале"><Link href="/models">Модели</Link><Link href="/events">События</Link><Link href="/contact">Сотрудничество</Link><Link href="/account">Кабинет</Link><Link href="/privacy">Данные и конфиденциальность</Link></nav><p>© {new Date().getFullYear()} Runway Models<br /><span>Independent model platform</span></p></div></footer>;
}
