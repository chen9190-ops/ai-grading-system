import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionCookieName, verifySessionToken, type UserRole } from "@/lib/auth";

const studentPaths = ["/", "/assistant", "/chat", "/errors", "/grading", "/practice", "/profile"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const session = await verifySessionToken(request.cookies.get(sessionCookieName)?.value);

  if (pathname === "/login") {
    if (!session) return NextResponse.next();
    return NextResponse.redirect(new URL(session.role === "teacher" ? "/teacher" : "/", request.url));
  }

  const requiredRole = getRequiredRole(pathname);
  if (!requiredRole) return NextResponse.next();

  if (!session) {
    if (pathname.startsWith("/api/")) return Response.json({ error: "未登录" }, { status: 401 });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role !== requiredRole) {
    if (pathname.startsWith("/api/")) return Response.json({ error: "无权访问" }, { status: 403 });
    return NextResponse.redirect(new URL(session.role === "teacher" ? "/teacher" : "/", request.url));
  }

  return NextResponse.next();
}

function getRequiredRole(pathname: string): UserRole | null {
  if (pathname === "/teacher" || pathname.startsWith("/teacher/") || pathname.startsWith("/api/teacher/")) return "teacher";
  if (studentPaths.some((path) => path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`))) return "student";
  return null;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/assistant/:path*",
    "/chat/:path*",
    "/errors/:path*",
    "/grading/:path*",
    "/practice/:path*",
    "/profile/:path*",
    "/teacher/:path*",
    "/api/teacher/:path*",
  ],
};
