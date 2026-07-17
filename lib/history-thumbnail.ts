export function historyThumbnailMode(imageUrl: string | null, loadFailed: boolean): "image" | "fallback" {
  return imageUrl && !loadFailed ? "image" : "fallback";
}
