export const basePath = process.env.NODE_ENV === "production"
  ? process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "/ai_grading_hust_course"
  : "";

export function withBasePath(pathname: string) {
  return `${basePath}${pathname}`;
}
