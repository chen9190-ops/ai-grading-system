"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import MobileShell from "../../components/mobile/MobileShell";
import MobileTopBar from "../../components/mobile/MobileTopBar";
import { withBasePath } from "@/lib/base-path";
import { formatScoreWithMaximum } from "@/lib/score-scale";
import { gradingHistoryPath } from "@/lib/grading-history";

type HistoryItem = { id: string; requestId: string | null; title: string; courseName: string; score: number | null; maxScore: 10; createdAt: string; hasReport: boolean };

export default function GradingHistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(withBasePath("/api/grade/history"), { cache: "no-store" }).then(async (response) => {
      const data: unknown = await response.json();
      if (!response.ok || !isRecord(data) || !Array.isArray(data.history)) throw new Error("历史记录加载失败");
      return data.history.filter(isHistoryItem);
    }).then((items) => { if (active) setHistory(items); }).catch(() => { if (active) setError("历史记录加载失败，请稍后重试"); }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  return <MobileShell><MobileTopBar title="全部解析记录" /><div className="space-y-3 px-4 py-5">{error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}{!loaded ? <div className="h-32 animate-pulse rounded-2xl bg-white/60" /> : history.length ? history.map((item) => <button type="button" key={item.id} onClick={() => router.push(gradingHistoryPath(item.id))} className="flex w-full cursor-pointer items-center gap-3 rounded-[20px] border border-white/80 bg-white/82 p-4 text-left shadow-[0_7px_20px_rgba(30,41,59,.07)] transition active:bg-blue-50"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><FileText className="size-5" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.title}</strong><span className="mt-1 block text-[10px] text-slate-400">{item.courseName} · {formatDate(item.createdAt)}</span><span className="mt-1 block text-[9px] text-slate-400">requestId: {item.requestId || "未记录"}</span></span><span className="shrink-0 text-right"><strong className="block text-sm text-blue-600">{formatScoreWithMaximum(item.score)}</strong><span className="text-[9px] text-slate-400">{item.hasReport ? "查看详情" : "无完整报告"}</span><ChevronRight className="ml-auto mt-1 size-4 text-slate-300" /></span></button>) : !error ? <div className="rounded-[20px] bg-white/80 px-6 py-12 text-center text-sm text-slate-500">暂无历史解析记录</div> : null}</div></MobileShell>;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isHistoryItem(value: unknown): value is HistoryItem { return isRecord(value) && typeof value.id === "string" && (value.requestId === null || typeof value.requestId === "string") && typeof value.title === "string" && typeof value.courseName === "string" && (value.score === null || typeof value.score === "number") && value.maxScore === 10 && typeof value.createdAt === "string" && typeof value.hasReport === "boolean"; }
function formatDate(value: string) { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
