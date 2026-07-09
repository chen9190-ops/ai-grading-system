import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const requiredStringFields = [
  "problemImageName",
  "answerImageName",
  "gradingResult",
] as const;

export async function POST(request: Request) {
  try {
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
    if (score !== null && (score < 0 || score > 100)) {
      return Response.json({ error: "score 必须在 0 到 100 之间" }, { status: 400 });
    }

    const submission = await prisma.submission.create({
      data: {
        studentName: asString(body.studentName) || "匿名学生",
        studentId: asNullableString(body.studentId),
        courseName: asString(body.courseName) || "工程课程",
        className: asNullableString(body.className),
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
      },
    });

    return Response.json({ submission }, { status: 201 });
  } catch (error) {
    console.error("Failed to save submission", error);
    return Response.json({ error: "批改记录保存失败" }, { status: 500 });
  }
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
