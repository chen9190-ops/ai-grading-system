import { callDifyChatflow, DifyChatflowError } from "@/lib/dify";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const message = await readMessage(request);
  if (!message) {
    return Response.json(
      { success: false, error: "请输入有效的训练需求" },
      { status: 400 },
    );
  }

  try {
    const paper = await callDifyChatflow({
      apiKey: process.env.DIFY_PRACTICE_API_KEY,
      url: process.env.DIFY_PRACTICE_URL || "https://api.dify.ai/v1/chat-messages",
      query: message,
      user: "student",
    });
    return Response.json({ success: true, paper });
  } catch (error) {
    console.error("Practice Chatflow request failed", error);
    return Response.json(
      {
        success: false,
        error: error instanceof DifyChatflowError
          ? error.message
          : "AI 试卷生成暂时不可用",
      },
      { status: 502 },
    );
  }
}

async function readMessage(request: Request) {
  try {
    const value: unknown = await request.json();
    if (!isRecord(value) || typeof value.message !== "string") return "";
    const message = value.message.trim();
    return message.length > 0 && message.length <= 8000 ? message : "";
  } catch {
    return "";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
