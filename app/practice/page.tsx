"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowRight,
  Atom,
  BookOpenCheck,
  BrainCircuit,
  Dumbbell,
  FileClock,
  Layers3,
  LoaderCircle,
  Send,
  Sparkles,
  Wind,
} from "lucide-react";
import MobileShell from "../components/mobile/MobileShell";
import MobileTopBar from "../components/mobile/MobileTopBar";
import { withBasePath } from "@/lib/base-path";
import { formatScoreWithMaximum, parseScore, scoreProgress } from "@/lib/score-scale";

type HistoryItem = {
  id: string;
  createdAt: string;
  problemFileName: string;
  resultPreview: string;
  score?: string;
};

type Course = {
  name: string;
  description: string;
  keywords: string[];
  icon: typeof Atom;
};

const historyStorageKey = "ai-grading-history";
const courses: Course[] = [
  { name: "理论力学", description: "静力学 · 运动学 · 动力学", keywords: ["理论力学", "静力学", "运动学", "动力学", "力矩"], icon: Atom },
  { name: "材料力学", description: "应力 · 变形 · 强度", keywords: ["材料力学", "应力", "应变", "梁", "弯曲"], icon: Layers3 },
  { name: "空气动力学", description: "流场 · 升阻力 · 边界层", keywords: ["空气动力学", "流体", "升力", "阻力", "边界层"], icon: Wind },
];
const quickOptions = ["期末复习", "章节强化", "薄弱提升"];

export default function PracticePage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [notice, setNotice] = useState("");
  const [paper, setPaper] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setHistory(readHistory());
      setLoaded(true);
    });
  }, []);

  const mastery = useMemo(() => courses.map((course) => ({
    course,
    ...calculateCourseMastery(course, history),
  })), [history]);

  async function generatePractice() {
    const message = prompt.trim();
    if (!message) {
      setNotice("请先描述你想训练的课程或章节");
      return;
    }

    setGenerating(true);
    setNotice("");
    setPaper("");

    try {
      const response = await fetch(withBasePath("/api/practice/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload: unknown = await response.json();

      if (!isRecord(payload) || !response.ok || payload.success !== true || typeof payload.paper !== "string" || !payload.paper.trim()) {
        const error = isRecord(payload) && typeof payload.error === "string" ? payload.error : "AI 试卷生成失败";
        throw new Error(error);
      }

      setPaper(payload.paper.trim());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "AI 试卷生成失败，请稍后重试");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <MobileShell>
      <MobileTopBar title="AI训练中心" showBack={false} rightAction={<span className="grid size-10 place-items-center rounded-full bg-blue-50 text-blue-600"><Dumbbell className="size-5" /></span>} />

      <div className="space-y-6 px-4 py-5">
        <section className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_90%_0%,rgba(59,130,246,.3),transparent_38%),linear-gradient(145deg,#17283e,#0c1829)] p-5 text-white shadow-[0_14px_34px_rgba(15,23,42,.22)]">
          <div className="absolute -bottom-16 -right-10 size-44 rounded-full border border-white/10" />
          <div className="relative flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-blue-300/20 bg-blue-400/15 text-blue-300"><BrainCircuit className="size-6" /></span><div><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-blue-300">Personalized practice</p><h1 className="mt-1.5 text-xl font-bold">智能专项训练</h1><p className="mt-2 text-xs leading-5 text-slate-300">根据你的学习情况生成个性化训练。</p></div></div>
          <div className="relative mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-[10px] text-slate-400"><Sparkles className="size-3.5 text-blue-300" />结合历史解析记录评估课程掌握程度</div>
        </section>

        <section>
          <SectionTitle eyebrow="Focused training" title="专项训练" />
          <div className="space-y-3">
            {mastery.map(({ course, score, recordCount }) => {
              const Icon = course.icon;
              return <article key={course.name} className="rounded-[24px] border border-white/80 bg-white/80 p-4 shadow-[0_8px_24px_rgba(30,41,59,.07)] backdrop-blur-md"><div className="flex items-center gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Icon className="size-6" strokeWidth={1.7} /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-bold">{course.name}</h3><p className="mt-1 text-[10px] text-slate-400">{course.description}</p></div><div className="text-right"><p className="text-[9px] text-slate-400">掌握程度</p><p className={`mt-1 text-sm font-bold ${score === null ? "text-slate-400" : "text-blue-600"}`}>{loaded ? score === null ? "暂无数据" : formatScoreWithMaximum(score) : "--"}</p></div></div>{score !== null ? <div className="mt-4"><div className="flex justify-between text-[9px] text-slate-400"><span>基于 {recordCount} 条相关解析</span><span>{getMasteryLabel(score)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${scoreProgress(score) * 100}%` }} /></div></div> : <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-[10px] text-slate-400">完成相关课程的 AI 批改后，将自动生成掌握度。</p>}<button type="button" onClick={() => { setPrompt(`生成${course.name}专项训练`); setNotice(""); }} className="mt-4 flex h-10 w-full items-center justify-center gap-1.5 rounded-[14px] bg-blue-50 text-xs font-semibold text-blue-600 transition active:scale-[.98] active:bg-blue-100"><Dumbbell className="size-4" />开始训练<ArrowRight className="size-3.5" /></button></article>;
            })}
          </div>
        </section>

        <section>
          <SectionTitle eyebrow="AI paper generator" title="AI生成试卷" />
          <div className="rounded-[24px] border border-white/80 bg-white/85 p-4 shadow-[0_9px_26px_rgba(30,41,59,.08)] backdrop-blur-md">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[14px] bg-blue-600 text-white shadow-[0_6px_14px_rgba(37,99,235,.24)]"><BookOpenCheck className="size-5" /></span><div><h3 className="text-sm font-bold">描述你的训练目标</h3><p className="mt-0.5 text-[10px] text-slate-400">由 Dify Chatflow 实时生成</p></div></div>
            <textarea value={prompt} onChange={(event) => { setPrompt(event.target.value); setNotice(""); }} rows={3} placeholder="例如：生成理论力学第二章10道中等难度训练题" disabled={generating} className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100/60 disabled:opacity-60" />
            <div className="mt-3 flex flex-wrap gap-2">{quickOptions.map((option) => <button type="button" key={option} onClick={() => { setPrompt(option); setNotice(""); }} className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition ${prompt === option ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>{option}</button>)}</div>
            {notice ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[10px] text-amber-700">{notice}</p> : null}
            <button type="button" onClick={() => void generatePractice()} disabled={generating || !prompt.trim()} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1686f7] to-[#0753bc] text-sm font-semibold text-white shadow-[0_9px_20px_rgba(8,112,229,.26)] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none">{generating ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{generating ? "AI 正在生成试卷..." : "生成训练"}{generating ? null : <Send className="size-4" />}</button>
          </div>
          {paper ? <article className="mt-4 overflow-hidden rounded-[24px] border border-white/80 bg-white/82 shadow-[0_9px_26px_rgba(30,41,59,.08)] backdrop-blur-md"><div className="border-b border-slate-200/70 bg-slate-100/65 px-4 py-3"><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-blue-600">Generated paper</p><h3 className="mt-1 text-sm font-bold">AI 生成训练试卷</h3></div><div className="px-4 py-4"><ReactMarkdown components={{ h1: ({ children }) => <h1 className="mb-4 text-xl font-bold text-slate-800">{children}</h1>, h2: ({ children }) => <h2 className="mb-2 mt-5 border-l-2 border-blue-500 pl-2 text-base font-bold text-slate-800 first:mt-0">{children}</h2>, h3: ({ children }) => <h3 className="mb-2 mt-4 text-sm font-bold text-slate-700">{children}</h3>, p: ({ children }) => <p className="my-2 whitespace-pre-wrap text-xs leading-6 text-slate-600">{children}</p>, ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 text-xs leading-6 text-slate-600">{children}</ul>, ol: ({ children }) => <ol className="my-2 list-decimal space-y-2 pl-5 text-xs leading-6 text-slate-600">{children}</ol>, strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>, hr: () => <hr className="my-4 border-slate-200" /> }}>{paper}</ReactMarkdown></div></article> : null}
        </section>

        <section>
          <SectionTitle eyebrow="Training history" title="训练记录" />
          <div className="rounded-[24px] border border-white/80 bg-white/75 px-6 py-12 text-center shadow-[0_8px_24px_rgba(30,41,59,.06)] backdrop-blur-md"><span className="mx-auto grid size-14 place-items-center rounded-[20px] bg-slate-100 text-slate-400"><FileClock className="size-6" /></span><h3 className="mt-4 text-sm font-bold text-slate-600">暂无训练记录</h3><p className="mt-2 text-[11px] leading-5 text-slate-400">完成 AI 训练后，训练名称、完成时间和得分会显示在这里。</p></div>
        </section>
      </div>
    </MobileShell>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="mb-3 px-1"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-blue-600">{eyebrow}</p><h2 className="mt-0.5 text-lg font-bold">{title}</h2></div>;
}

function calculateCourseMastery(course: Course, history: HistoryItem[]) {
  const relatedScores = history.filter((item) => {
    const searchable = `${item.problemFileName} ${item.resultPreview}`.toLowerCase();
    return course.keywords.some((keyword) => searchable.includes(keyword.toLowerCase()));
  }).map((item) => parseScore(item.score)).filter((score): score is number => score !== null);

  return {
    recordCount: relatedScores.length,
    score: relatedScores.length ? relatedScores.reduce((sum, score) => sum + score, 0) / relatedScores.length : null,
  };
}

function getMasteryLabel(score: number) {
  if (score >= 8.5) return "掌握良好";
  if (score >= 6) return "持续巩固";
  return "建议强化";
}

function readHistory(): HistoryItem[] {
  try {
    const stored = window.localStorage.getItem(historyStorageKey);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter(isHistoryItem) : [];
  } catch {
    return [];
  }
}

function isHistoryItem(value: unknown): value is HistoryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<HistoryItem>;
  return typeof item.id === "string" && typeof item.createdAt === "string" && typeof item.problemFileName === "string" && typeof item.resultPreview === "string" && (item.score === undefined || typeof item.score === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
