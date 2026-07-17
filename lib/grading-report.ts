const outputFieldPriority = [
  "result",
  "text",
  "answer",
  "output",
  "content",
  "markdown",
] as const;

const gradingKeywords = ["题目理解", "评分建议", "学生答案", "标准解法", "第一处实质性错误"];
const minimumReportLength = 50;

export type SelectedGradingReport = {
  markdown: string;
  score: number | null;
  maxScore: 10;
  outputKeys: string[];
  selectedOutputField: string | null;
  selectedTextLength: number;
  hadThinkBlock: boolean;
};

export type GradingReportSection = {
  title: string;
  markdown: string;
};

export function selectGradingReport(outputs: unknown): SelectedGradingReport {
  const outputKeys = isRecord(outputs) ? Object.keys(outputs) : [];

  for (const field of outputFieldPriority) {
    const rawText = getKnownText(isRecord(outputs) ? outputs[field] : undefined);
    if (!rawText) continue;
    const markdown = cleanGradingMarkdown(rawText);
    if (!isReasonableGradingText(markdown)) continue;

    return {
      markdown,
      score: extractScore(markdown),
      maxScore: 10,
      outputKeys,
      selectedOutputField: field,
      selectedTextLength: markdown.length,
      hadThinkBlock: /<think>[\s\S]*?<\/think>/i.test(rawText),
    };
  }

  return {
    markdown: "",
    score: null,
    maxScore: 10,
    outputKeys,
    selectedOutputField: null,
    selectedTextLength: 0,
    hadThinkBlock: false,
  };
}

export function selectGradingReportFromPayload(payload: unknown) {
  const existingReport = getRecordValue(payload, "gradingReport");
  const existingMarkdown = getRecordValue(existingReport, "markdown");
  if (typeof existingMarkdown === "string") {
    return selectGradingReport({ result: existingMarkdown });
  }

  const data = getRecordValue(payload, "data");
  const outputs = getRecordValue(data, "outputs") ?? getRecordValue(payload, "outputs");
  const selected = selectGradingReport(outputs);
  if (selected.markdown) return selected;

  return selectGradingReport({ result: getRecordValue(payload, "result") });
}

export function cleanGradingMarkdown(value: string) {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .trim();
}

export function isReasonableGradingText(value: string) {
  if (value.trim().length < minimumReportLength) return false;
  return gradingKeywords.some((keyword) => value.includes(keyword)) || /#{1,6}\s+.+/m.test(value);
}

export function extractScore(text: string): number | null {
  const normalized = cleanGradingMarkdown(text);
  const scoringHeading = normalized.search(/评分建议(?:\s*[（(]满分\s*10\s*分?[）)])?/i);
  const scoringArea = scoringHeading >= 0
    ? normalized.slice(scoringHeading, scoringHeading + 500)
    : normalized;
  const patterns = [
    /(?:建议给分|评分|得分)\s*[:：]?\s*\*{0,2}\s*(10|[0-9](?:\.\d+)?)\s*分?\s*\*{0,2}\s*(?:\/\s*10)?/i,
    /\*{1,2}\s*(10|[0-9](?:\.\d+)?)\s*分\s*\*{1,2}/i,
    /\b(10|[0-9](?:\.\d+)?)\s*\/\s*10\b/i,
  ];

  for (const area of scoringHeading >= 0 ? [scoringArea, normalized] : [normalized]) {
    for (const pattern of patterns) {
      const match = area.match(pattern);
      if (!match) continue;
      const score = Number(match[1]);
      if (Number.isFinite(score) && score >= 0 && score <= 10) return score;
    }
  }
  return null;
}

export function splitGradingReport(markdown: string): GradingReportSection[] {
  const cleaned = cleanGradingMarkdown(markdown);
  const headingPattern = /^#{1,6}\s+(.+)$/gm;
  const matches = [...cleaned.matchAll(headingPattern)];
  if (matches.length === 0) return [];

  const sections: GradingReportSection[] = [];
  const preamble = cleaned.slice(0, matches[0].index).trim();
  if (preamble) sections.push({ title: "批改报告", markdown: preamble });

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? cleaned.length;
    sections.push({
      title: match[1].replace(/\*+/g, "").trim(),
      markdown: cleaned.slice(start, end).trim(),
    });
  }
  return sections.filter((section) => section.markdown);
}

function getKnownText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return "";
  for (const field of outputFieldPriority) {
    if (typeof value[field] === "string") return value[field];
  }
  return "";
}

function getRecordValue(value: unknown, key: string) {
  return isRecord(value) ? value[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
