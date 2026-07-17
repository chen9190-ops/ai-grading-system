"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Atom,
  BookOpenCheck,
  BrainCircuit,
  Dumbbell,
  FileClock,
  LineChart,
  Layers3,
  LoaderCircle,
  Bot,
  Download,
  Lightbulb,
  RefreshCw,
  PenLine,
  CheckCheck,
  Send,
  Sparkles,
  Wind,
} from "lucide-react";
import MobileShell from "../components/mobile/MobileShell";
import MobileTopBar from "../components/mobile/MobileTopBar";
import { withBasePath } from "@/lib/base-path";
import { formatScoreWithMaximum, parseScore, scoreProgress } from "@/lib/score-scale";
import { gradingHistoryPath } from "@/lib/grading-history";
import GradingMarkdown from "../components/GradingMarkdown";
import { normalizePracticeMarkdown, parsePracticePaper, type PracticePaper, type PracticeQuestion } from "@/lib/practice-paper";
import { createTrainingAssistantContext, trainingAssistantContextKey, type TrainingAssistantAction } from "@/lib/training-assistant-context";

type HistoryItem = {
  id: string;
  createdAt: string;
  problemFileName: string;
  resultPreview: string;
  score?: string;
  courseName: string;
  gradingResult: string;
  knowledgePoint: string | null;
};
type SubmissionPayload = {
  id: string;
  createdAt: string;
  problemImageName: string;
  gradingResult: string;
  courseName: string;
  score: number | null;
  knowledgePoint: string | null;
};

type Course = {
  name: string;
  description: string;
  keywords: string[];
  icon: typeof Atom;
};

const courses: Course[] = [
  { name: "理论力学", description: "静力学 · 运动学 · 动力学", keywords: ["理论力学", "静力学", "运动学", "动力学", "力矩"], icon: Atom },
  { name: "材料力学", description: "应力 · 变形 · 强度", keywords: ["材料力学", "应力", "应变", "梁", "弯曲"], icon: Layers3 },
  { name: "空气动力学", description: "流场 · 升阻力 · 边界层", keywords: ["空气动力学", "流体", "升力", "阻力", "边界层"], icon: Wind },
];
const quickOptions = ["期末复习", "章节强化", "薄弱提升"];

export default function PracticePage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [notice, setNotice] = useState("");
  const [paper, setPaper] = useState("");
  const [structuredPaper, setStructuredPaper] = useState<PracticePaper | null>(null);
  const [paperId, setPaperId] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);
  const [activeAnswerId, setActiveAnswerId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch(withBasePath("/api/submissions"), { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok || !isRecord(payload) || !Array.isArray(payload.submissions)) throw new Error("成绩数据加载失败");
        return payload.submissions.filter(isSubmission).map((item) => ({
          id: item.id,
          createdAt: item.createdAt,
          problemFileName: item.problemImageName,
          resultPreview: item.gradingResult,
          score: item.score === null ? undefined : `${item.score}/10`,
          courseName: item.courseName,
          gradingResult: item.gradingResult,
          knowledgePoint: item.knowledgePoint,
        }));
      })
      .then((items) => { if (active) setHistory(items); })
      .catch(() => { if (active) setNotice("成绩数据加载失败，请稍后重试"); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const mastery = useMemo(() => courses.map((course) => ({
    course,
    ...calculateCourseMastery(course, history),
  })), [history]);
  const scoredHistory = useMemo(() => history.filter((item) => parseScore(item.score) !== null), [history]);
  const averageScore = useMemo(() => scoredHistory.length ? scoredHistory.reduce((sum, item) => sum + (parseScore(item.score) ?? 0), 0) / scoredHistory.length : null, [scoredHistory]);

  function viewSubmission(item: HistoryItem) {
    router.push(gradingHistoryPath(item.id));
  }

  async function generatePractice() {
    const message = prompt.trim();
    if (!message) {
      setNotice("请先描述你想训练的课程或章节");
      return;
    }

    setGenerating(true);
    setNotice("");
    setPaper("");
    setStructuredPaper(null);
    setPaperId("");

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
      setStructuredPaper(parsePracticePaper(payload.paper.trim()));
      setPaperId(isRecord(payload.conversation) && typeof payload.conversation.id === "string" ? payload.conversation.id : "");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "AI 试卷生成失败，请稍后重试");
    } finally {
      setGenerating(false);
    }
  }

  function exportPdf() {
    if (!paper) return;
    try {
      document.body.classList.add("practice-print-mode");
      const cleanup = () => document.body.classList.remove("practice-print-mode");
      window.addEventListener("afterprint", cleanup, { once: true });
      window.print();
      window.setTimeout(cleanup, 1_000);
    } catch {
      setNotice("PDF 导出失败，当前试卷仍保留在页面中");
    }
  }

  function openAssistant(question: PracticeQuestion | null, requestedAction: TrainingAssistantAction) {
    try {
      const context = createTrainingAssistantContext(paperId, question, requestedAction);
      if (!question && structuredPaper) {
        context.questionMarkdown = structuredPaper.questions.map((item) => `第${item.index}题\n${item.stemMarkdown}`).join("\n\n").slice(0, 8_000);
        context.knowledgePoints = [...new Set(structuredPaper.questions.flatMap((item) => item.knowledgePoints))].slice(0, 10);
        context.difficulty = structuredPaper.difficulty;
      }
      window.sessionStorage.setItem(trainingAssistantContextKey, JSON.stringify(context));
    } catch {
      setNotice("AI 助手上下文传递失败，已进入普通聊天");
    }
    router.push("/chat");
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
          <SectionTitle eyebrow="Score analysis" title="成绩分析" />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[22px] border border-white/80 bg-white/82 p-4 shadow-[0_8px_24px_rgba(30,41,59,.07)]"><p className="text-[10px] text-slate-400">平均成绩（满分10分）</p><p className="mt-2 text-2xl font-bold text-blue-600">{loaded ? formatScoreWithMaximum(averageScore) : "--"}</p></div>
            <div className="rounded-[22px] border border-white/80 bg-white/82 p-4 shadow-[0_8px_24px_rgba(30,41,59,.07)]"><p className="text-[10px] text-slate-400">批改次数</p><p className="mt-2 text-2xl font-bold text-slate-800">{loaded ? history.length : "--"}<span className="ml-1 text-xs font-medium text-slate-400">次</span></p></div>
          </div>
          <div className="mt-3 rounded-[22px] border border-white/80 bg-white/82 p-4 shadow-[0_8px_24px_rgba(30,41,59,.07)]">
            <div className="flex items-center gap-2"><LineChart className="size-4 text-blue-600" /><h3 className="text-sm font-bold">成绩趋势</h3></div>
            {scoredHistory.length ? <div className="mt-4 flex h-28 items-end gap-2">{scoredHistory.slice(0, 8).reverse().map((item) => <div key={item.id} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"><span className="text-[8px] text-slate-400">{parseScore(item.score)}</span><div className="w-full rounded-t bg-gradient-to-t from-blue-600 to-cyan-400" style={{ height: `${Math.max(4, scoreProgress(parseScore(item.score)) * 88)}px` }} /></div>)}</div> : <p className="mt-4 text-center text-xs text-slate-400">暂无成绩趋势数据</p>}
          </div>
        </section>

        <section>
          <SectionTitle eyebrow="Recent scores" title="最近成绩（满分10分）" />
          <div className="overflow-hidden rounded-[22px] border border-white/80 bg-white/82 shadow-[0_8px_24px_rgba(30,41,59,.07)]">
            {loaded && scoredHistory.length ? scoredHistory.slice(0, 8).map((item, index) => <button type="button" key={item.id} onClick={() => viewSubmission(item)} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${index ? "border-t border-slate-100" : ""}`}><span className="min-w-16 text-sm font-bold text-blue-600">{formatScoreWithMaximum(parseScore(item.score))}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.courseName}</strong><span className="mt-1 block truncate text-[10px] text-slate-400">{item.problemFileName} · {formatDate(item.createdAt)}</span></span><ArrowRight className="size-4 shrink-0 text-slate-300" /></button>) : loaded ? <div className="px-5 py-8 text-center text-xs text-slate-400">暂无成绩记录，完成首次 AI 批改后将在这里显示。</div> : <div className="h-24 animate-pulse bg-white/50" />}
          </div>
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
          {paper ? <article className="practice-paper-print mt-4 overflow-hidden rounded-[24px] border border-white/80 bg-white/82 shadow-[0_9px_26px_rgba(30,41,59,.08)] backdrop-blur-md"><div className="border-b border-slate-200/70 bg-slate-100/65 px-4 py-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-blue-600">Generated paper</p><h3 className="mt-1 text-base font-bold">{structuredPaper?.paperTitle || "AI 生成训练试卷"}</h3>{structuredPaper ? <p className="mt-1 text-[10px] text-slate-500">{[structuredPaper.course, structuredPaper.chapter, structuredPaper.difficulty, structuredPaper.estimatedMinutes ? `${structuredPaper.estimatedMinutes} 分钟` : ""].filter(Boolean).join(" · ")}</p> : null}</div><div className="no-print flex flex-wrap justify-end gap-1.5"><button type="button" onClick={exportPdf} className="flex items-center gap-1 rounded-xl bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-600 shadow-sm"><Download className="size-3.5" />导出PDF</button><button type="button" onClick={() => openAssistant(null, "paper")} className="flex items-center gap-1 rounded-xl bg-blue-600 px-2.5 py-2 text-[10px] font-semibold text-white"><Bot className="size-3.5" />发送到AI助手</button>{structuredPaper?.questions.some((item) => item.answer) ? <button type="button" onClick={() => setShowAnswers((value) => !value)} className="rounded-xl bg-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-600">{showAnswers ? "学生版" : "教师版"}</button> : null}</div></div></div>{structuredPaper ? <div className="space-y-4 p-4">{structuredPaper.questions.map((item) => <section key={item.id} className="question-card rounded-[20px] border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-2"><h4 className="text-sm font-bold">第 {item.index} 题</h4><div className="flex items-center gap-2 text-[9px] text-slate-400">{item.score !== null ? <span>{item.score} 分</span> : null}{item.difficulty ? <span>{item.difficulty}</span> : null}</div></div>{item.knowledgePoints.length ? <div className="mt-2 flex flex-wrap gap-1">{item.knowledgePoints.map((point) => <span key={point} className="rounded-full bg-blue-50 px-2 py-1 text-[9px] text-blue-600">{point}</span>)}</div> : null}{item.imageUrl ? <img src={item.imageUrl} alt={`第${item.index}题题图`} className="mt-3 max-h-64 w-full rounded-xl object-contain" /> : null}<div className="mt-3 overflow-x-auto"><GradingMarkdown content={item.stemMarkdown} /></div>{showAnswers && item.answer ? <div className="teacher-answer mt-3 rounded-xl bg-emerald-50 p-3"><p className="text-[10px] font-semibold text-emerald-700">标准答案与评分点</p><GradingMarkdown content={item.answer} /></div> : null}{activeAnswerId === item.id ? <textarea rows={4} placeholder="在这里输入你的作答..." className="no-print mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-blue-300" /> : null}<div className="no-print mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"><PaperAction icon={Bot} label="讲解本题" onClick={() => openAssistant(item, "explain")} /><PaperAction icon={Lightbulb} label="给我提示" onClick={() => openAssistant(item, "hint")} /><PaperAction icon={RefreshCw} label="生成同类题" onClick={() => openAssistant(item, "similar")} /><PaperAction icon={PenLine} label="开始作答" onClick={() => setActiveAnswerId(item.id)} /><PaperAction icon={CheckCheck} label="检查我的答案" onClick={() => openAssistant(item, "check")} /></div></section>)}</div> : <div className="px-4 py-4"><p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[10px] text-amber-700">结构化解析失败，已回退为完整 Markdown 预览。</p><div className="overflow-x-auto"><GradingMarkdown content={normalizePracticeMarkdown(paper)} /></div></div>}<div className="print-page-number hidden" /></article> : null}
        </section>

        <section>
          <SectionTitle eyebrow="Training history" title="训练记录" />
          <div className="rounded-[24px] border border-white/80 bg-white/75 px-6 py-12 text-center shadow-[0_8px_24px_rgba(30,41,59,.06)] backdrop-blur-md"><span className="mx-auto grid size-14 place-items-center rounded-[20px] bg-slate-100 text-slate-400"><FileClock className="size-6" /></span><h3 className="mt-4 text-sm font-bold text-slate-600">暂无训练记录</h3><p className="mt-2 text-[11px] leading-5 text-slate-400">完成 AI 训练后，训练名称、完成时间和得分会显示在这里。</p></div>
        </section>
      </div>
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 16mm 14mm 18mm; }
          body.practice-print-mode * { visibility: hidden !important; }
          body.practice-print-mode .practice-paper-print,
          body.practice-print-mode .practice-paper-print * { visibility: visible !important; }
          body.practice-print-mode .practice-paper-print { position: absolute; inset: 0; width: 100%; border: 0; box-shadow: none; background: white; }
          body.practice-print-mode .no-print { display: none !important; }
          body.practice-print-mode .question-card { break-inside: avoid; page-break-inside: avoid; }
          body.practice-print-mode .print-page-number { display: block !important; position: fixed; right: 0; bottom: -10mm; font-size: 9px; color: #64748b; }
          body.practice-print-mode .print-page-number::after { content: "第 " counter(page) " 页"; }
          body.practice-print-mode .katex-display { overflow: visible; }
        }
      `}</style>
    </MobileShell>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="mb-3 px-1"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-blue-600">{eyebrow}</p><h2 className="mt-0.5 text-lg font-bold">{title}</h2></div>;
}

function PaperAction({ icon: Icon, label, onClick }: { icon: typeof Bot; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex h-9 items-center justify-center gap-1 rounded-xl bg-slate-100 px-2 text-[10px] font-semibold text-slate-600 active:bg-blue-50 active:text-blue-600"><Icon className="size-3.5" />{label}</button>;
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

function isSubmission(value: unknown): value is SubmissionPayload {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.createdAt === "string" && typeof value.problemImageName === "string" && typeof value.gradingResult === "string" && typeof value.courseName === "string" && (value.score === null || typeof value.score === "number") && (value.knowledgePoint === null || typeof value.knowledgePoint === "string");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
