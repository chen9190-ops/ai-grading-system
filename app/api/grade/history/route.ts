import { selectGradingReport } from "@/lib/grading-report";

const unavailableMessage = "历史记录详情暂时无法获取，请重新批改。";

export async function GET(request: Request) {
  const apiKey = process.env.DIFY_API_KEY;
  const baseUrl = process.env.DIFY_BASE_URL;
  const { searchParams } = new URL(request.url);
  const workflowRunId = searchParams.get("id");

  if (!apiKey || !baseUrl || !workflowRunId) {
    return Response.json({ error: unavailableMessage }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/workflows/run/${encodeURIComponent(
        workflowRunId,
      )}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    if (!response.ok) {
      return Response.json({ error: unavailableMessage }, { status: 502 });
    }

    const data = await response.json();
    const workflowData = getRecordValue(data, "data") ?? data;
    const selected = selectGradingReport(getRecordValue(workflowData, "outputs"));
    if (!selected.markdown) {
      console.error("history grading output missing", {
        workflowRunId,
        outputKeys: selected.outputKeys,
      });
      return Response.json({ error: unavailableMessage }, { status: 502 });
    }

    return Response.json({
      markdown: selected.markdown,
      score: selected.score,
      maxScore: 10,
      workflowRunId,
    });
  } catch {
    return Response.json({ error: unavailableMessage }, { status: 502 });
  }
}

function getRecordValue(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }

  return (value as Record<string, unknown>)[key];
}
