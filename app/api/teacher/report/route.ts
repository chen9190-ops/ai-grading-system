type CountItem = {
  name: string;
  count: number;
};

type ReportInput = {
  student_count: number;
  average_score: number;
  weak_points: CountItem[];
  error_types: CountItem[];
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const input = await readInput(request);

  if (!input) {
    return Response.json(
      { success: false, error: "班级学习数据格式无效" },
      { status: 400 },
    );
  }

  const apiKey = process.env.DIFY_TEACHER_REPORT_API_KEY;
  const workflowUrl = process.env.DIFY_WORKFLOW_URL;

  if (!apiKey || !workflowUrl) {
    return Response.json(
      { success: false, error: "Dify 教学报告服务尚未配置" },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(workflowUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: input,
        response_mode: "blocking",
        user: "teacher",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(extractDifyError(data) || `Dify 请求失败（${response.status}）`);
    }

    const report = extractReport(data);

    if (!report) {
      throw new Error("Dify Workflow 未返回报告内容");
    }

    return Response.json({ success: true, report });
  } catch (error) {
    console.error("Failed to generate Dify teaching report", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "AI 教学报告生成失败",
      },
      { status: 502 },
    );
  }
}

async function readInput(request: Request): Promise<ReportInput | null> {
  try {
    const value: unknown = await request.json();
    if (!isRecord(value)) return null;

    const studentCount = value.student_count;
    const averageScore = value.average_score;
    const weakPoints = parseCountItems(value.weak_points);
    const errorTypes = parseCountItems(value.error_types);

    if (
      typeof studentCount !== "number" ||
      !Number.isInteger(studentCount) ||
      studentCount < 0 ||
      typeof averageScore !== "number" ||
      !Number.isFinite(averageScore) ||
      !weakPoints ||
      !errorTypes
    ) {
      return null;
    }

    return {
      student_count: studentCount,
      average_score: averageScore,
      weak_points: weakPoints,
      error_types: errorTypes,
    };
  } catch {
    return null;
  }
}

function parseCountItems(value: unknown): CountItem[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;

  const items: CountItem[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      item.name.length > 200 ||
      typeof item.count !== "number" ||
      !Number.isInteger(item.count) ||
      item.count < 0
    ) {
      return null;
    }
    items.push({ name: item.name.trim(), count: item.count });
  }

  return items;
}

function extractReport(value: unknown): string {
  if (!isRecord(value)) return "";

  const nestedData = isRecord(value.data) ? value.data : null;
  const nestedOutputs = nestedData && isRecord(nestedData.outputs) ? nestedData.outputs : null;
  const directOutputs = isRecord(value.outputs) ? value.outputs : null;
  const text = nestedOutputs?.text ?? directOutputs?.text;

  if (typeof text === "string" && text.trim()) {
    return text.trim();
  }

  if (text !== undefined && text !== null) {
    return typeof text === "string" ? text : JSON.stringify(text, null, 2);
  }

  return JSON.stringify(value, null, 2);
}

function extractDifyError(value: unknown): string {
  if (!isRecord(value)) return "";
  const message = value.message ?? value.error;
  return typeof message === "string" ? message : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
