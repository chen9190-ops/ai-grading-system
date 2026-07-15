import "server-only";

import { cookies } from "next/headers";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";

export async function getCurrentSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(sessionCookieName)?.value);
}
