"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BookOpen, ChevronRight, FileWarning } from "lucide-react";
import MobileShell from "../components/mobile/MobileShell";
import MobileTopBar from "../components/mobile/MobileTopBar";
import { withBasePath } from "@/lib/base-path";
import { formatScoreWithMaximum } from "@/lib/score-scale";
import { gradingHistoryPath } from "@/lib/grading-history";

type Submission = {
  id: string;
  courseName: string;
  assignmentName: string | null;
  problemImageName: string;
  gradingResult: string;
  score: number | null;
  firstError: string | null;
  errorType: string | null;
  knowledgePoint: string | null;
  createdAt: string;
};

export default function ErrorsPage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(withBasePath("/api/submissions"), { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok || !isRecord(payload) || !Array.isArray(payload.submissions)) throw new Error("错题数据加载失败");
        return payload.submissions.filter(isSubmission);
      })
      .then((items) => { if (active) setSubmissions(items); })
      .catch(() => { if (active) setError("错题数据加载失败，请稍后重试"); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const errors = useMemo(() => submissions.filter((item) => Boolean(item.firstError || item.errorType)), [submissions]);

  function viewSubmission(item: Submission) {
    router.push(gradingHistoryPath(item.id));
  }

  return (
    <MobileShell>
      <MobileTopBar title="错题本" showBack={false} rightAction={<span className="grid size-10 place-items-center rounded-full bg-amber-50 text-amber-600"><BookOpen className="size-5" /></span>} />
      <div className="px-4 py-5">
        <section className="rounded-[24px] bg-[radial-gradient(circle_at_90%_0%,rgba(251,146,60,.25),transparent_38%),linear-gradient(145deg,#17283e,#0c1829)] p-5 text-white shadow-[0_14px_34px_rgba(15,23,42,.22)]">
          <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-orange-300">Mistake notebook</p>
          <h1 className="mt-2 text-xl font-bold">真实错题记录</h1>
          <p className="mt-2 text-xs leading-5 text-slate-300">集中复盘 AI 批改中识别出的错误步骤和薄弱知识点。</p>
        </section>

        <section className="mt-6">
          <div className="mb-3 px-1"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-blue-600">Recent errors</p><h2 className="mt-0.5 text-lg font-bold">错题列表</h2></div>
          {error ? <div className="rounded-[20px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
          {!loaded ? <div className="h-32 animate-pulse rounded-[22px] bg-white/60" /> : errors.length ? <div className="space-y-3">{errors.map((item) => <button type="button" key={item.id} onClick={() => viewSubmission(item)} className="flex w-full items-center gap-3 rounded-[22px] border border-white/80 bg-white/82 p-4 text-left shadow-[0_8px_24px_rgba(30,41,59,.08)]"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600"><AlertCircle className="size-5" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.knowledgePoint || item.assignmentName || item.problemImageName}</strong><span className="mt-1 block truncate text-[10px] text-slate-500">{item.courseName} · {item.errorType || "错误类型待复盘"}</span><span className="mt-1 block text-[9px] text-slate-400">{formatDate(item.createdAt)}</span></span><span className="shrink-0 text-right"><strong className="block text-sm text-blue-600">{formatScoreWithMaximum(item.score)}</strong><ChevronRight className="ml-auto mt-1 size-4 text-slate-300" /></span></button>)}</div> : !error ? <div className="rounded-[22px] border border-white/80 bg-white/82 px-6 py-12 text-center shadow-[0_8px_24px_rgba(30,41,59,.07)]"><FileWarning className="mx-auto size-8 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-600">暂无错题记录</p><p className="mt-1 text-xs leading-5 text-slate-400">完成 AI 批改并识别到错误后，记录会显示在这里。</p></div> : null}
        </section>
      </div>
    </MobileShell>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSubmission(value: unknown): value is Submission {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.courseName === "string" && typeof value.problemImageName === "string" && typeof value.gradingResult === "string" && typeof value.createdAt === "string" && (value.assignmentName === null || typeof value.assignmentName === "string") && (value.score === null || typeof value.score === "number") && (value.firstError === null || typeof value.firstError === "string") && (value.errorType === null || typeof value.errorType === "string") && (value.knowledgePoint === null || typeof value.knowledgePoint === "string");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
