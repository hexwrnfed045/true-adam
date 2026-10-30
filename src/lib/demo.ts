"use client";
import { useSyncExternalStore } from "react";
export type DemoRecord = { id: string; title: string; type: string; createdAt: string; status: string; name: string; email: string; };
const event = "runway-storage";
export function getStored(key: string) { if (typeof window === "undefined") return ""; try { return localStorage.getItem(key) || ""; } catch { return ""; } }
export function putStored(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event(event)); }
function subscribe(fn: () => void) { window.addEventListener("storage", fn); window.addEventListener(event, fn); return () => { window.removeEventListener("storage", fn); window.removeEventListener(event, fn); }; }
export function useStored<T>(key: string, fallback: T): T { const raw = useSyncExternalStore(subscribe, () => getStored(key), () => ""); try { return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
export function saveDemoRecord(record: Omit<DemoRecord, "id" | "createdAt" | "status">) { const old: DemoRecord[] = JSON.parse(getStored("runway-applications") || "[]"); const next = { ...record, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "Черновик" }; putStored("runway-applications", [...old, next]); return next; }
