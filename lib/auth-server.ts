import "server-only";

import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { type AppUser, type UserRole } from "@/lib/auth";

const prismaRoles = {
  student: "STUDENT",
  teacher: "TEACHER",
  admin: "ADMIN",
} as const;

export async function authenticateApplicationUser(
  username: string,
  password: string,
  role: UserRole,
): Promise<AppUser | null> {
  const normalizedUsername = username.trim().toLowerCase();

  try {
    const databaseUser = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedUsername, mode: "insensitive" },
        role: prismaRoles[role],
      },
    });

    if (databaseUser && await compare(password, databaseUser.password)) {
      return {
        id: databaseUser.id,
        username: databaseUser.email,
        displayName: databaseUser.name,
        role,
      };
    }
  } catch (error) {
    console.error("Database authentication unavailable", error);
  }

  return authenticateConfiguredDemoUser(username, password, role);
}

async function authenticateConfiguredDemoUser(
  username: string,
  password: string,
  role: UserRole,
): Promise<AppUser | null> {
  const prefix = role.toUpperCase();
  const configuredUsername = process.env[`${prefix}_USERNAME`]?.trim();
  const configuredPasswordHash = process.env[`${prefix}_PASSWORD_HASH`]?.trim();
  if (!configuredUsername || !configuredPasswordHash) return null;
  if (username.trim() !== configuredUsername || !(await compare(password, configuredPasswordHash))) return null;

  return {
    id: process.env[`${prefix}_USER_ID`]?.trim() || `${role}-demo`,
    username: configuredUsername,
    displayName: process.env[`${prefix}_DISPLAY_NAME`]?.trim() || configuredUsername,
    role,
  };
}
