import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionCookieName, verifySessionToken, type UserRole } from "@/lib/auth";

const studentPaths = ["/", "/assistant", "/chat", "/errors", "/grading", "/practice", "/profile"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const session = await verifySessionToken(request.cookies.get(sessionCookieName)?.value);

  if (pathname === "/login") {
    if (!session) return NextResponse.next();
    return NextResponse.redirect(new URL(session.role === "student" ? "/" : "/teacher", request.url));
  }

  const requiredRole = getRequiredRole(pathname);
  if (!requiredRole) return NextResponse.next();

  if (!session) {
    if (pathname.startsWith("/api/")) return Response.json({ error: "未登录" }, { status: 401 });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role !== "admin" && session.role !== requiredRole) {
    if (pathname.startsWith("/api/")) return Response.json({ error: "无权访问" }, { status: 403 });
    return NextResponse.redirect(new URL(session.role === "student" ? "/" : "/teacher", request.url));
  }

  return NextResponse.next();
}

function getRequiredRole(pathname: string): UserRole | null {
  if (pathname === "/teacher" || pathname.startsWith("/teacher/") || pathname.startsWith("/exam/") || pathname.startsWith("/report/") || pathname.startsWith("/api/teacher/") || pathname.startsWith("/api/exam/") || pathname.startsWith("/api/report/")) return "teacher";
  if (pathname.startsWith("/student/") || pathname.startsWith("/api/assistant/") || pathname.startsWith("/api/practice/")) return "student";
  if (pathname === "/api/submissions" || pathname === "/api/grade" || pathname.startsWith("/api/grade/")) return "student";
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
    "/student/:path*",
    "/exam/:path*",
    "/report/:path*",
    "/api/assistant/:path*",
    "/api/practice/:path*",
    "/api/submissions",
    "/api/grade/:path*",
    "/api/exam/:path*",
    "/api/report/:path*",
  ],
};
