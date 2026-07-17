"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { historyThumbnailMode } from "@/lib/history-thumbnail";

export default function HistoryThumbnail({ title, imageUrl, className = "size-14" }: { title: string; imageUrl: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!imageUrl || historyThumbnailMode(imageUrl, failed) === "fallback") return <span data-thumbnail-fallback="true" className={`grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 ${className}`}><FileText className="size-6" /></span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={withBasePath(imageUrl)} alt={`题目图片：${title}`} className={`shrink-0 rounded-xl object-cover ${className}`} onError={() => setFailed(true)} />;
}
