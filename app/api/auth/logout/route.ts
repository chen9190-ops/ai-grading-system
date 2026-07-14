import { sessionCookieName } from "@/lib/auth";

export async function POST() {
  const response = Response.json({ success: true });
  response.headers.append("Set-Cookie", `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}
