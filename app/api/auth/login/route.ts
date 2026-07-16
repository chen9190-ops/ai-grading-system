import { createSessionToken, sessionCookieName, sessionMaxAgeSeconds, type UserRole } from "@/lib/auth";
import { authenticateApplicationUser } from "@/lib/auth-server";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "登录信息格式无效" }, { status: 400 });
    }

    if (!isRecord(body)) {
      return Response.json({ error: "请完整填写用户名、密码和角色" }, { status: 400 });
    }

    const username = typeof body.username === "string"
      ? body.username
      : typeof body.email === "string"
        ? body.email
        : null;
    const role = normalizeRole(body.role);

    console.info("Login request received", {
      hasUsername: typeof body.username === "string",
      hasEmail: typeof body.email === "string",
      hasPassword: typeof body.password === "string",
      role,
    });

    if (!username?.trim() || typeof body.password !== "string" || !body.password || !role) {
      return Response.json({ error: "请完整填写用户名、密码和角色" }, { status: 400 });
    }

    if (!process.env.AUTH_SECRET?.trim()) {
      console.error("Login failed: AUTH_SECRET is not configured");
      return Response.json({ error: "服务器认证配置缺失，请联系管理员" }, { status: 500 });
    }

    const user = await authenticateApplicationUser(username, body.password, role);
    if (!user) return Response.json({ error: "用户名、密码或角色不正确" }, { status: 401 });

    const token = await createSessionToken(user);
    const response = Response.json({ user, redirectTo: user.role === "student" ? "/" : "/teacher" });
    response.headers.append("Set-Cookie", `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return response;
  } catch (error) {
    console.error("Login request failed", error);
    return Response.json({ error: "登录服务暂时不可用，请稍后重试" }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== "string") return null;
  const normalizedRole = value.trim().toLowerCase();
  return normalizedRole === "student" || normalizedRole === "teacher" || normalizedRole === "admin"
    ? normalizedRole
    : null;
}
