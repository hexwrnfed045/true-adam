import { favoritesGet, favoritesPut } from "@/lib/server/handlers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = favoritesGet;
export const PUT = favoritesPut;
