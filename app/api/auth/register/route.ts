import { Prisma, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await readRegistration(request);
    if (!input.ok) return Response.json({ error: input.error }, { status: 400 });

    const existing = await prisma.user.findUnique({
      where: { email: input.data.email },
      select: { id: true },
    });
    if (existing) return Response.json({ error: "该邮箱已注册" }, { status: 409 });

    const passwordHash = await hash(input.data.password, 12);
    await prisma.user.create({
      data: {
        name: input.data.name,
        email: input.data.email,
        password: passwordHash,
        role: UserRole.STUDENT,
        studentProfile: {
          create: {
            studentId: input.data.studentId,
            major: "未设置",
            className: "未分班",
          },
        },
      },
      select: { id: true },
    });

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(",")
        : String(error.meta?.target ?? "");
      const message = target.includes("studentId") ? "该学号已注册" : "该邮箱已注册";
      return Response.json({ error: message }, { status: 409 });
    }

    console.error("Student registration failed", error);
    return Response.json({ error: "注册服务暂时不可用，请稍后重试" }, { status: 500 });
  }
}

async function readRegistration(request: Request): Promise<
  | { ok: true; data: { studentId: string; name: string; email: string; password: string } }
  | { ok: false; error: string }
> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return { ok: false, error: "注册信息格式无效" };
  }
  if (!isRecord(value)) return { ok: false, error: "请完整填写注册信息" };

  const studentId = typeof value.studentId === "string" ? value.studentId.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const password = typeof value.password === "string" ? value.password : "";
  const confirmPassword = typeof value.confirmPassword === "string" ? value.confirmPassword : "";

  if (!/^[A-Za-z0-9_-]{4,32}$/.test(studentId)) return { ok: false, error: "学号应为 4-32 位字母、数字、下划线或短横线" };
  if (name.length < 2 || name.length > 50) return { ok: false, error: "姓名长度应为 2-50 个字符" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { ok: false, error: "请输入有效邮箱" };
  if (password.length < 8 || password.length > 128) return { ok: false, error: "密码长度应为 8-128 个字符" };
  if (password !== confirmPassword) return { ok: false, error: "两次输入的密码不一致" };

  return { ok: true, data: { studentId, name, email, password } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
