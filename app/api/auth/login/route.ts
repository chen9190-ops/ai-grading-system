import { authenticateUser, createSessionToken, sessionCookieName, sessionMaxAgeSeconds, type UserRole } from "@/lib/auth";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "登录信息格式无效" }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.username !== "string" || typeof body.password !== "string" || (body.role !== "student" && body.role !== "teacher")) {
    return Response.json({ error: "请完整填写用户名、密码和角色" }, { status: 400 });
  }

  const user = authenticateUser(body.username, body.password, body.role as UserRole);
  if (!user) return Response.json({ error: "用户名、密码或角色不正确" }, { status: 401 });

  const token = await createSessionToken(user);
  const response = Response.json({ user, redirectTo: user.role === "teacher" ? "/teacher" : "/" });
  response.headers.append("Set-Cookie", `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
