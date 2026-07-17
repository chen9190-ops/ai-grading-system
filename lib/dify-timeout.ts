export const DEFAULT_DIFY_GRADING_TIMEOUT_MS = 360_000;

export function getDifyGradingTimeoutMs(value = process.env.DIFY_GRADING_TIMEOUT_MS): number {
  if (!value?.trim()) return DEFAULT_DIFY_GRADING_TIMEOUT_MS;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : DEFAULT_DIFY_GRADING_TIMEOUT_MS;
}

export function createDifyTimeoutController(
  timeoutMs: number,
  timers: {
    setTimer?: typeof setTimeout;
    clearTimer?: typeof clearTimeout;
  } = {},
) {
  const controller = new AbortController();
  const setTimer = timers.setTimer ?? setTimeout;
  const clearTimer = timers.clearTimer ?? clearTimeout;
  let timedOut = false;
  let cleaned = false;
  const timer = setTimer(() => {
    timedOut = true;
    controller.abort(new Error("DIFY_REQUEST_TIMEOUT"));
  }, timeoutMs);

  return {
    controller,
    didTimeOut: () => timedOut,
    cleanup: () => {
      if (cleaned) return;
      cleaned = true;
      clearTimer(timer);
    },
  };
}
