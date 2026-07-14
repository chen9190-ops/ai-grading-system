export type UserRole = "student" | "teacher";

export type AppUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
};

export type SessionPayload = AppUser & {
  expiresAt: number;
};

export const sessionCookieName = "aerospace_learning_session";
export const sessionMaxAgeSeconds = 60 * 60 * 8;

const fallbackSessionSecret = "ai-grading-system-local-session-secret-change-me";

export function authenticateUser(username: string, password: string, role: UserRole): AppUser | null {
  const users = getConfiguredUsers();
  const normalizedUsername = username.trim();
  const match = users.find((entry) => entry.user.username === normalizedUsername && entry.user.role === role);

  if (!match || !safeEqual(password, match.password)) return null;
  return match.user;
}

export async function createSessionToken(user: AppUser) {
  const payload: SessionPayload = {
    ...user,
    expiresAt: Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = await sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra) return null;

  const expectedSignature = await sign(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as Partial<SessionPayload>;
    if (
      typeof payload.id !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.displayName !== "string" ||
      (payload.role !== "student" && payload.role !== "teacher") ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return payload as SessionPayload;
  } catch {
    return null;
  }
}

function getConfiguredUsers() {
  return [
    {
      user: {
        id: "student-demo",
        username: process.env.STUDENT_USERNAME ?? "student",
        displayName: process.env.STUDENT_DISPLAY_NAME ?? "张同学",
        role: "student" as const,
      },
      password: process.env.STUDENT_PASSWORD ?? "student123",
    },
    {
      user: {
        id: "teacher-demo",
        username: process.env.TEACHER_USERNAME ?? "teacher",
        displayName: process.env.TEACHER_DISPLAY_NAME ?? "教师用户",
        role: "teacher" as const,
      },
      password: process.env.TEACHER_PASSWORD ?? "teacher123",
    },
  ];
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.AUTH_SECRET ?? fallbackSessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function encodeBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
