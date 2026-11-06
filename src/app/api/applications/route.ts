import { applicationsGet, applicationsPost } from "@/lib/server/handlers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = applicationsGet;
export const POST = applicationsPost;
