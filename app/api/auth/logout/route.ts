import { sessionCookieName, shouldUseSecureSessionCookie } from "@/lib/auth";

export async function POST() {
  const response = Response.json({ success: true });
  response.headers.append("Set-Cookie", `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${shouldUseSecureSessionCookie() ? "; Secure" : ""}`);
  return response;
}
