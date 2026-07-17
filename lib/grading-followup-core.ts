export type FollowupRole = "user" | "assistant";
export type FollowupMessage = { role: FollowupRole; content: string };

export const gradingFollowupApiPath = "/api/grading-followup";
export const maxFollowupQuestionLength = 2_000;
export const maxFollowupMessages = 20;

export function validateFollowupQuestion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const question = value.trim();
  return question && question.length <= maxFollowupQuestionLength ? question : null;
}

export function canAccessFollowupGrading(sessionUserId: string, gradingUserId: string | null): boolean {
  return Boolean(gradingUserId) && sessionUserId === gradingUserId;
}

export function limitFollowupHistory(messages: FollowupMessage[]): FollowupMessage[] {
  return messages.slice(-maxFollowupMessages);
}

export function buildFollowupRequest(question: string, gradingId: string, history: FollowupMessage[]) {
  return { question, gradingId, history: limitFollowupHistory(history) };
}

export function parseFollowupDifyAnswer(value: unknown): string {
  if (!isRecord(value) || typeof value.answer !== "string") return "";
  return value.answer.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

export function normalizeFollowupUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  return /\/chat-messages$/i.test(normalized) ? normalized : `${normalized}/chat-messages`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
