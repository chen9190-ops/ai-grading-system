import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { MAX_SCORE } from "@/lib/score-scale";

export const runtime = "nodejs";

const requiredStringFields = [
  "problemImageName",
  "answerImageName",
  "gradingResult",
] as const;

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return Response.json({ error: "未登录" }, { status: 401 });
    if (session.role !== "student" && session.role !== "admin") {
      return Response.json({ error: "无权保存学生批改记录" }, { status: 403 });
    }
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return Response.json({ error: "请求数据格式不正确" }, { status: 400 });
    }

    for (const field of requiredStringFields) {
      if (!asString(body[field])) {
        return Response.json({ error: `${field} 不能为空` }, { status: 400 });
      }
    }

    const score = asNumber(body.score);
    if (score !== null && (score < 0 || score > MAX_SCORE)) {
      return Response.json({ error: `score 必须在 0 到 ${MAX_SCORE} 之间` }, { status: 400 });
    }

    const sessionUser = await prisma.user.findUnique({ where: { id: session.id }, select: { id: true, name: true, studentProfile: { select: { studentId: true, className: true } } } });
    if (!sessionUser) return Response.json({ error: "当前登录用户尚未建立数据库档案" }, { status: 409 });

    const duplicate = await prisma.submission.findFirst({
      where: {
        userId: sessionUser.id,
        problemImageName: asString(body.problemImageName)!,
        answerImageName: asString(body.answerImageName)!,
        gradingResult: asString(body.gradingResult)!,
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      select: { id: true, createdAt: true },
    });
    if (duplicate) return Response.json({ submission: duplicate, duplicate: true }, { status: 200 });

    const submission = await prisma.submission.create({
      data: {
        studentName: sessionUser.name,
        studentId: sessionUser.studentProfile?.studentId ?? asNullableString(body.studentId),
        courseName: asString(body.courseName) || "工程课程",
        className: sessionUser.studentProfile?.className ?? asNullableString(body.className),
        problemImageName: asString(body.problemImageName)!,
        answerImageName: asString(body.answerImageName)!,
        problemOcr: asNullableString(body.problemOcr),
        answerOcr: asNullableString(body.answerOcr),
        problemDiagram: asNullableString(body.problemDiagram),
        answerDiagram: asNullableString(body.answerDiagram),
        gradingResult: asString(body.gradingResult)!,
        score,
        firstError: asNullableString(body.firstError),
        errorType: asNullableString(body.errorType),
        knowledgePoint: asNullableString(body.knowledgePoint),
        assignmentName: asNullableString(body.assignmentName),
        problemImages: asJson(body.problemImages),
        answerImages: asJson(body.answerImages),
        aiResult: {
          result: asString(body.gradingResult)!,
          firstError: asNullableString(body.firstError),
          errorType: asNullableString(body.errorType),
          knowledgePoint: asNullableString(body.knowledgePoint),
        },
        feedback: asNullableString(body.feedback),
        userId: sessionUser.id,
      },
    });

    return Response.json({ submission }, { status: 201 });
  } catch (error) {
    console.error("Failed to save submission", error);
    return Response.json({ error: "批改记录保存失败" }, { status: 500 });
  }
}

function asJson(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value.slice(0, 20)
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNullableString(value: unknown) {
  return asString(value);
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}
