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

    if (!isRecord(body) || typeof body.username !== "string" || typeof body.password !== "string" || (body.role !== "student" && body.role !== "teacher" && body.role !== "admin")) {
      return Response.json({ error: "请完整填写用户名、密码和角色" }, { status: 400 });
    }

    if (!process.env.AUTH_SECRET?.trim()) {
      console.error("Login failed: AUTH_SECRET is not configured");
      return Response.json({ error: "服务器认证配置缺失，请联系管理员" }, { status: 500 });
    }

    const user = await authenticateApplicationUser(body.username, body.password, body.role as UserRole);
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
