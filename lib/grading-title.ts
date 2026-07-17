const titleFields = ["questionTitle", "title", "problemTitle", "question_summary", "summary"] as const;
const questionTextFields = ["question", "problem", "question_text", "problem_text", "problemOcr", "problem_ocr"] as const;
const uploadNamePattern = /^(?:screenshot|screen\s*shot|img[_-]?\d*|image[_-]?\d*|微信图片|截屏|截图)/i;

export function selectQuestionTitle(outputs: unknown, fallbackText = ""): string {
  if (isRecord(outputs)) {
    for (const field of titleFields) {
      const title = normalizeCandidate(outputs[field]);
      if (title) return title;
    }
    for (const field of questionTextFields) {
      const title = createQuestionTitle(typeof outputs[field] === "string" ? outputs[field] : "");
      if (title) return title;
    }
  }
  return createQuestionTitle(fallbackText) || "理论力学题目";
}

export function createQuestionTitle(value: string): string {
  const cleaned = value
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[#*_`>$]/g, " ")
    .replace(/\\(?:begin|end)\{[^}]+}/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}^~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || uploadNamePattern.test(cleaned)) return "";
  const firstSentence = cleaned.split(/(?<=[。！？!?；;])\s*/)[0].replace(/[。！？!?；;]+$/, "").trim();
  if (!firstSentence) return "";
  const hasChinese = /[\u3400-\u9fff]/.test(firstSentence);
  if (hasChinese) return firstSentence.length <= 24 ? firstSentence : `${firstSentence.slice(0, 24).replace(/[，、,:：\s]+$/, "")}…`;
  if (firstSentence.length <= 60) return firstSentence;
  const words = firstSentence.slice(0, 61).split(/\s+/);
  if (words.length > 1) words.pop();
  return `${words.join(" ").replace(/[,.:\s]+$/, "")}…`;
}

export function historyTitle(savedTitle: unknown, problemOcr: unknown, courseName: unknown): string {
  const title = normalizeCandidate(savedTitle) || createQuestionTitle(typeof problemOcr === "string" ? problemOcr : "");
  if (title) return title;
  return typeof courseName === "string" && courseName.trim() ? `${courseName.trim()}题目` : "理论力学题目";
}

function normalizeCandidate(value: unknown): string {
  if (typeof value !== "string") return "";
  const title = createQuestionTitle(value);
  return title && !uploadNamePattern.test(title) ? title : "";
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
