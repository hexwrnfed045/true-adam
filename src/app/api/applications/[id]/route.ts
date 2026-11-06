import { applicationGet, applicationPatch } from "@/lib/server/handlers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = applicationGet;
export const PATCH = applicationPatch;
