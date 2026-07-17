"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FileWarning } from "lucide-react";
import MobileShell from "../../../components/mobile/MobileShell";
import MobileTopBar from "../../../components/mobile/MobileTopBar";
import GradingMarkdown from "../../../components/GradingMarkdown";
import { withBasePath } from "@/lib/base-path";
import { formatScoreWithMaximum } from "@/lib/score-scale";

type HistoryDetail = { id: string; requestId: string | null; workflowRunId: string | null; title: string; courseName: string; score: number | null; maxScore: 10; markdown: string; createdAt: string; problemImageUrl: string | null; answerImageUrl: string | null };

export default function GradingHistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(withBasePath(`/api/grade/history?id=${encodeURIComponent(params.id)}`), { cache: "no-store" }).then(async (response) => {
      const data: unknown = await response.json();
      if (!response.ok || !isHistoryDetail(data)) throw new Error(isRecord(data) && typeof data.error === "string" ? data.error : "历史记录加载失败");
      return data;
    }).then((data) => { if (active) setDetail(data); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "历史记录加载失败"); }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [params.id]);

  return <MobileShell><MobileTopBar title="历史批改详情" />{!loaded ? <div className="mx-4 mt-5 h-40 animate-pulse rounded-2xl bg-white/60" /> : error || !detail ? <div className="mx-4 mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error || "历史记录加载失败"}</div> : <div className="space-y-4 px-4 py-5"><section className="rounded-[22px] border border-white/80 bg-white/82 p-4 shadow-[0_7px_20px_rgba(30,41,59,.07)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h1 className="text-base font-bold">{detail.title}</h1><p className="mt-1 text-xs text-slate-500">{detail.courseName} · {formatDate(detail.createdAt)}</p></div><strong className="shrink-0 text-lg text-blue-600">{detail.score === null ? "暂无评分" : formatScoreWithMaximum(detail.score)}</strong></div><div className="mt-3 border-t border-slate-100 pt-3 text-[10px] leading-5 text-slate-400"><p>requestId: {detail.requestId || "未记录"}</p><p>workflowRunId: {detail.workflowRunId || "未记录"}</p></div></section>{detail.problemImageUrl || detail.answerImageUrl ? <section className="grid gap-3 sm:grid-cols-2">{detail.problemImageUrl ? <HistoryImage title="题目原图" alt={`题目图片：${detail.title}`} imageUrl={detail.problemImageUrl} /> : null}{detail.answerImageUrl ? <HistoryImage title="学生答案原图" alt={`学生答案图片：${detail.title}`} imageUrl={detail.answerImageUrl} /> : null}</section> : null}{detail.markdown ? <section className="rounded-[22px] border border-white/80 bg-white/85 p-4 shadow-[0_7px_20px_rgba(30,41,59,.07)]"><GradingMarkdown content={detail.markdown} /></section> : <section className="rounded-[22px] border border-amber-200 bg-amber-50 p-6 text-center"><FileWarning className="mx-auto size-8 text-amber-500" /><p className="mt-3 text-sm font-semibold text-amber-800">该历史记录未保存完整的 AI 批改报告，无法查看详细解析。</p></section>}</div>}</MobileShell>;
}

function HistoryImage({ title, alt, imageUrl }: { title: string; alt: string; imageUrl: string }) {
  const src = withBasePath(imageUrl);
  // eslint-disable-next-line @next/next/no-img-element
  return <a href={src} target="_blank" rel="noreferrer" className="overflow-hidden rounded-[20px] border border-white/80 bg-white/85 p-3 shadow-[0_7px_20px_rgba(30,41,59,.07)]"><p className="mb-2 text-xs font-semibold text-slate-600">{title}</p><img src={src} alt={alt} className="h-48 w-full rounded-xl object-contain" /></a>;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isHistoryDetail(value: unknown): value is HistoryDetail { return isRecord(value) && typeof value.id === "string" && (value.requestId === null || typeof value.requestId === "string") && (value.workflowRunId === null || typeof value.workflowRunId === "string") && typeof value.title === "string" && typeof value.courseName === "string" && (value.score === null || typeof value.score === "number") && value.maxScore === 10 && typeof value.markdown === "string" && typeof value.createdAt === "string"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
