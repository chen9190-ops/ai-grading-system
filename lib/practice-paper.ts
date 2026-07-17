export type PracticeQuestion = {
  id: string;
  index: number;
  score: number | null;
  stemMarkdown: string;
  imageUrl: string | null;
  knowledgePoints: string[];
  difficulty: string;
  answer: string | null;
};

export type PracticePaper = {
  paperTitle: string;
  course: string;
  chapter: string;
  difficulty: string;
  estimatedMinutes: number | null;
  questions: PracticeQuestion[];
};

export function parsePracticePaper(value: string): PracticePaper | null {
  const parsed = parseJson(value);
  if (!isRecord(parsed) || !Array.isArray(parsed.questions) || !parsed.questions.length) return null;
  const questions = parsed.questions.map(parseQuestion).filter((item): item is PracticeQuestion => item !== null);
  if (!questions.length) return null;
  return {
    paperTitle: text(parsed.paperTitle) || text(parsed.title) || "AI 生成训练试卷",
    course: text(parsed.course) || "工程课程",
    chapter: text(parsed.chapter),
    difficulty: text(parsed.difficulty) || "中等",
    estimatedMinutes: finiteNumber(parsed.estimatedMinutes),
    questions,
  };
}

export function normalizePracticeMarkdown(value: string): string {
  const prepared = value
    .replace(/```latex\s*([\s\S]*?)```/gi, (_match, formula: string) => `$$\n${formula.trim()}\n$$`)
    .replace(/\\text\s*\{/g, "\\mathrm{")
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula: string) => `$$\n${formula.trim()}\n$$`)
    .replace(/\\\(([^\n]*?)\\\)/g, (_match, formula: string) => `$${formula.trim()}$`);
  let insideDisplayMath = false;
  return prepared.split(/\r?\n/).map((line) => {
    if (line.trim() === "$$") {
      insideDisplayMath = !insideDisplayMath;
      return line;
    }
    return insideDisplayMath ? line : normalizeMathLine(line);
  }).join("\n").trim();
}

function normalizeMathLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return line;
  let normalized = line;
  const dollarCount = (normalized.match(/(?<!\\)\$/g) ?? []).length;
  if (dollarCount % 2 === 1) normalized += "$";
  if (!normalized.includes("$") && /\\(?:mathrm|frac|sqrt|cdot|times|vec|sum|int)\b|[A-Za-z]\s*=/.test(normalized)) {
    const markdownPrefix = normalized.match(/^(\s*(?:[-*+] |\d+[.)] ))/)?.[1] ?? "";
    const content = normalized.slice(markdownPrefix.length).trim();
    if (!/[\u4e00-\u9fff]/.test(content)) return `${markdownPrefix}$${content}$`;
    normalized = normalized.replace(/((?:[A-Za-z]\s*=\s*)?[-+]?\d+(?:\.\d+)?\s*,?\s*\\mathrm\{[^}]+\})/g, "$$$1$");
  }
  return normalized;
}

function parseQuestion(value: unknown, arrayIndex: number): PracticeQuestion | null {
  if (typeof value === "string" && value.trim()) {
    return { id: `question-${arrayIndex + 1}`, index: arrayIndex + 1, score: null, stemMarkdown: normalizePracticeMarkdown(value), imageUrl: null, knowledgePoints: [], difficulty: "", answer: null };
  }
  if (!isRecord(value)) return null;
  const stem = text(value.stemMarkdown) || text(value.stem) || text(value.question) || text(value.content);
  if (!stem) return null;
  return {
    id: text(value.id) || `question-${arrayIndex + 1}`,
    index: finiteNumber(value.index) ?? arrayIndex + 1,
    score: finiteNumber(value.score),
    stemMarkdown: normalizePracticeMarkdown(stem),
    imageUrl: safeImageUrl(value.imageUrl),
    knowledgePoints: Array.isArray(value.knowledgePoints) ? value.knowledgePoints.map(text).filter(Boolean).slice(0, 10) : [],
    difficulty: text(value.difficulty),
    answer: text(value.answer) ? normalizePracticeMarkdown(text(value.answer)) : null,
  };
}

function parseJson(value: string): unknown {
  try {
    const normalized = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const start = normalized.indexOf("{");
    const end = normalized.lastIndexOf("}");
    return start >= 0 && end > start ? JSON.parse(normalized.slice(start, end + 1)) : null;
  } catch {
    return null;
  }
}

function safeImageUrl(value: unknown): string | null {
  const url = text(value);
  return url && (/^https:\/\//i.test(url) || /^\/[^/]/.test(url)) ? url : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
