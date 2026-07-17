export const MAX_SCORE = 10;

export function formatScore(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatScoreWithMaximum(score: number | null | undefined): string {
  return typeof score === "number" && Number.isFinite(score)
    ? `${formatScore(score)} / ${MAX_SCORE}`
    : "--";
}

export function scoreProgress(score: number | null | undefined): number {
  if (typeof score !== "number" || !Number.isFinite(score)) return 0;
  return Math.min(1, Math.max(0, score / MAX_SCORE));
}

export function parseScore(value?: string): number | null {
  if (!value) return null;
  const numbers = value.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!Number.isFinite(numbers[0])) return null;
  const score = Number.isFinite(numbers[1]) && numbers[1] > 0
    ? (numbers[0] / numbers[1]) * MAX_SCORE
    : numbers[0];
  return score >= 0 && score <= MAX_SCORE ? score : null;
}
