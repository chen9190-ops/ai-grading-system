const outputFieldPriority = [
  "result",
  "grading_report",
  "report",
  "markdown",
  "answer",
  "text",
  "output",
  "content",
  "note_text",
  "direct_text",
  "reference_text",
] as const;

const excludedOutputFields = new Set([
  "created_at",
  "timestamp",
  "id",
  "request_id",
  "workflow_run_id",
  "status",
  "score",
  "tokens",
  "elapsed_time",
]);

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

export type ExtractedGradingContent = {
  markdown: string;
  sourceField: string | null;
  availableKeys: string[];
  hadThinkBlock: boolean;
};

export function selectGradingReport(outputs: unknown): SelectedGradingReport {
  const extracted = extractGradingContent(outputs);
  if (extracted.markdown) return {
    markdown: extracted.markdown,
    score: extractScore(extracted.markdown),
    maxScore: 10,
    outputKeys: extracted.availableKeys,
    selectedOutputField: extracted.sourceField,
    selectedTextLength: extracted.markdown.length,
    hadThinkBlock: extracted.hadThinkBlock,
  };

  return {
    markdown: "",
    score: null,
    maxScore: 10,
    outputKeys: extracted.availableKeys,
    selectedOutputField: null,
    selectedTextLength: 0,
    hadThinkBlock: false,
  };
}

export function extractGradingContent(outputs: unknown): ExtractedGradingContent {
  const parsedOutputs = parseJsonObject(outputs) ?? outputs;
  const availableKeys = isRecord(parsedOutputs) ? Object.keys(parsedOutputs) : [];
  const candidate = findKnownContent(parsedOutputs, "", 0);
  if (!candidate) return { markdown: "", sourceField: null, availableKeys, hadThinkBlock: false };

  return {
    markdown: cleanGradingMarkdown(candidate.text),
    sourceField: candidate.path,
    availableKeys,
    hadThinkBlock: /<think>[\s\S]*?<\/think>/i.test(candidate.text),
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

function findKnownContent(value: unknown, parentPath: string, depth: number): { text: string; path: string } | null {
  const parsed = parseJsonObject(value) ?? value;
  if (!isRecord(parsed) || depth > 2) return null;

  for (const field of outputFieldPriority) {
    const candidate = parsed[field];
    const path = parentPath ? `${parentPath}.${field}` : field;
    if (typeof candidate === "string") {
      const parsedCandidate = parseJsonObject(candidate);
      if (parsedCandidate && depth < 2) {
        const nested = findKnownContent(parsedCandidate, path, depth + 1);
        if (nested) return nested;
      }
      const markdown = cleanGradingMarkdown(candidate);
      if (isReasonableGradingText(markdown)) return { text: candidate, path };
    } else if (isRecord(candidate) && depth < 2) {
      const nested = findKnownContent(candidate, path, depth + 1);
      if (nested) return nested;
    }
  }

  if (depth >= 2) return null;
  for (const [field, candidate] of Object.entries(parsed)) {
    if (excludedOutputFields.has(field) || outputFieldPriority.includes(field as typeof outputFieldPriority[number])) continue;
    const nestedValue = parseJsonObject(candidate) ?? candidate;
    if (!isRecord(nestedValue)) continue;
    const path = parentPath ? `${parentPath}.${field}` : field;
    const nested = findKnownContent(nestedValue, path, depth + 1);
    if (nested) return nested;
  }
  return null;
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) return value;
  if (typeof value !== "string" || !value.trim().startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getRecordValue(value: unknown, key: string) {
  return isRecord(value) ? value[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
