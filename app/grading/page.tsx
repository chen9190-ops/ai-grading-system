"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "../components/mobile/MobileShell";
import MobileTopBar from "../components/mobile/MobileTopBar";
import GradingMarkdown from "../components/GradingMarkdown";
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  ImageIcon,
  Send,
  Share2,
  Sparkles,
} from "lucide-react";
import {
  cleanGradingMarkdown,
  extractScore,
  isReasonableGradingText,
  splitGradingReport,
} from "@/lib/grading-report";

type GradingResult = {
  requestId: string;
  markdown: string;
  createdAt: string;
  workflowRunId: string;
  maxScore: 10;
  questionImage: string;
  questionFileName: string;
  score: number | null;
  questionType: string;
  difficulty: number;
  knowledgePoints: string[];
  errorLocation: string;
  errorReason: string;
  improvement: string;
};

const gradingResultStorageKey = "ai-grading-current-result";

export default function GradingPage() {
  const router = useRouter();
  const [data, setData] = useState<GradingResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [question, setQuestion] = useState("");
  const [sentQuestion, setSentQuestion] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setData(readGradingResult());
      setLoaded(true);
    });
  }, []);

  const sections = useMemo(() => splitGradingReport(data?.markdown ?? ""), [data]);
  const isCorrect = data?.score === null || data?.score === undefined ? null : data.score >= 6;

  function submitQuestion() {
    const nextQuestion = question.trim();

    if (!nextQuestion) return;

    setSentQuestion(nextQuestion);
    setQuestion("");
  }

  async function shareResult() {
    if (typeof navigator.share !== "function") return;

    try {
      await navigator.share({ title: "AI拍照解析", text: "查看我的 AI 批改结果" });
    } catch {
      // The native share sheet can be dismissed without changing the page.
    }
  }

  if (!loaded) {
    return <MobileShell showBottomNav={false}><div className="min-h-screen" /></MobileShell>;
  }

  if (!data) {
    return (
      <MobileShell padded>
        <div className="w-full max-w-[390px] rounded-[28px] bg-white p-8 text-center shadow-[0_16px_50px_rgba(15,23,42,.12)]">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Sparkles className="size-6" /></div>
          <h1 className="mt-5 text-lg font-bold">暂无批改结果</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">请先返回首页上传题目和学生答案，完成 AI 批改。</p>
          <button type="button" onClick={() => router.push("/")} className="mt-6 h-12 w-full rounded-2xl bg-blue-600 text-sm font-semibold text-white">返回首页</button>
        </div>
      </MobileShell>
    );
  }

  const knowledgePoints = data.knowledgePoints;

  return (
    <MobileShell className="pb-40">
        <MobileTopBar title="AI拍照解析" rightAction={<>
              <button type="button" onClick={() => setIsSaved((current) => !current)} aria-label="收藏" className={`grid size-9 place-items-center rounded-full bg-white/75 shadow-sm ${isSaved ? "text-blue-600" : "text-slate-600"}`}><Bookmark className="size-[18px]" fill={isSaved ? "currentColor" : "none"} /></button>
              <button type="button" onClick={shareResult} aria-label="分享" className="grid size-9 place-items-center rounded-full bg-white/75 text-slate-600 shadow-sm"><Share2 className="size-[18px]" /></button>
        </>} />

        <div className="space-y-5 px-4 py-4">
          <section>
            <SectionTitle eyebrow="Question recognition" title="题目识别" />
            <div className="overflow-hidden rounded-[24px] border border-white/80 bg-white/80 p-3 shadow-[0_10px_30px_rgba(30,41,59,.08)] backdrop-blur-md">
              <div className="grid min-h-44 place-items-center overflow-hidden rounded-[18px] bg-[#f6f7f8]">
                {data.questionImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.questionImage} alt="题目图片" className="max-h-72 w-full object-contain" />
                ) : (
                  <div className="text-center text-slate-400"><ImageIcon className="mx-auto size-8" /><p className="mt-2 text-xs">{data.questionFileName || "历史题目图片"}</p></div>
                )}
              </div>
              <div className="px-1 pb-1 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label="题型" value={data.questionType || "理论力学"} />
                  <div><p className="text-[10px] text-slate-400">难度</p><p className="mt-1 text-sm tracking-[2px] text-blue-500">{"★".repeat(Math.max(1, Math.min(5, data.difficulty || 3)))}<span className="text-slate-200">{"★".repeat(5 - Math.max(1, Math.min(5, data.difficulty || 3)))}</span></p></div>
                </div>
                {knowledgePoints.length ? <div className="mt-4"><p className="text-[10px] text-slate-400">涉及知识点</p><div className="mt-2 flex flex-wrap gap-2">{knowledgePoints.map((point) => <span key={point} className="rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-medium text-blue-600">{point}</span>)}</div></div> : null}
              </div>
            </div>
          </section>

          <section>
            <SectionTitle eyebrow="AI grading report" title="AI批改报告" />
            {!data.markdown ? (
              <div className="rounded-[20px] border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">未能读取 AI 批改正文，请使用 requestId {data.requestId || "unknown"} 联系管理员。</div>
            ) : sections.length ? (
              <div className="space-y-3">{sections.map((section, index) => <article key={`${section.title}-${index}`} className="overflow-hidden rounded-[20px] border border-white/80 bg-white/85 p-4 shadow-[0_7px_20px_rgba(30,41,59,.07)] backdrop-blur-md"><h3 className="mb-3 text-sm font-bold text-slate-800">{section.title}</h3><GradingMarkdown content={section.markdown} /></article>)}</div>
            ) : (
              <article className="overflow-hidden rounded-[20px] border border-white/80 bg-white/85 p-4 shadow-[0_7px_20px_rgba(30,41,59,.07)] backdrop-blur-md"><GradingMarkdown content={data.markdown} /></article>
            )}
          </section>

          <section>
            <SectionTitle eyebrow="Grading result" title="批改结果" />
            <div className="overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_92%_5%,rgba(59,130,246,.28),transparent_35%),linear-gradient(145deg,#17263a,#0d1828)] p-5 text-white shadow-[0_14px_32px_rgba(15,23,42,.22)]">
              <div className="flex items-center justify-between">
                <div><p className="text-[10px] uppercase tracking-[.16em] text-slate-400">综合评分</p><p className="mt-2"><strong className="text-4xl">{data.score ?? "--"}</strong>{data.score !== null ? <span className="ml-1 text-sm text-slate-400">/ 10 分</span> : null}</p></div>
                <div className={`grid size-16 place-items-center rounded-full border ${isCorrect === false ? "border-orange-400/40 bg-orange-400/10 text-orange-300" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"}`}>{isCorrect === false ? <AlertCircle className="size-8" /> : <CheckCircle2 className="size-8" />}</div>
              </div>
              <div className="mt-5 border-t border-white/10 pt-4"><p className="text-sm font-semibold">{isCorrect === false ? "本题存在需要修正的步骤" : "整体作答完成良好"}</p><p className="mt-1.5 text-xs leading-5 text-slate-400">AI 已完成题目理解、计算过程与最终答案核验，请结合下方纠错建议复习。</p></div>
            </div>
          </section>

          {sentQuestion ? <div className="ml-auto max-w-[85%] rounded-[18px_18px_4px_18px] bg-blue-600 px-4 py-3 text-sm leading-6 text-white shadow-md">{sentQuestion}<p className="mt-1 text-[10px] text-blue-200">追问功能即将开放</p></div> : null}
        </div>

        <div className="fixed inset-x-0 bottom-[70px] z-30 mx-auto w-full max-w-[430px] border-t border-slate-200/80 bg-white/90 px-4 pb-3 pt-3 shadow-[0_-8px_28px_rgba(15,23,42,.08)] backdrop-blur-xl">
          <div className="flex items-center gap-2 rounded-[20px] border border-slate-200 bg-[#f5f6f8] p-1.5 pl-4 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100/60">
            <input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitQuestion(); }} placeholder="请输入你的问题..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
            <button type="button" onClick={submitQuestion} disabled={!question.trim()} aria-label="发送追问" className="grid size-10 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white shadow-md disabled:bg-slate-300"><Send className="size-[18px]" /></button>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5 text-[10px] text-slate-500"><button type="button" onClick={() => setQuestion("为什么这里取这个方向？")} className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5">为什么这里取这个方向？</button><button type="button" onClick={() => setQuestion("还有其他方法吗？")} className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5">还有其他方法吗？</button></div>
        </div>
    </MobileShell>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="mb-3 px-1"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-blue-600">{eyebrow}</p><h2 className="mt-0.5 text-lg font-bold">{title}</h2></div>;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}

function readGradingResult(): GradingResult | null {
  try {
    const storedValue = window.sessionStorage.getItem(gradingResultStorageKey);
    if (!storedValue) return null;
    const parsed = JSON.parse(storedValue) as Partial<GradingResult> & { result?: unknown };
    const candidate = typeof parsed.markdown === "string" ? parsed.markdown : typeof parsed.result === "string" ? parsed.result : "";
    const markdown = cleanGradingMarkdown(candidate);
    const validMarkdown = isReasonableGradingText(markdown) ? markdown : "";
    const storedScore = typeof parsed.score === "number" && parsed.score >= 0 && parsed.score <= 10 ? parsed.score : null;
    return { requestId: typeof parsed.requestId === "string" ? parsed.requestId : "", markdown: validMarkdown, createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : "", workflowRunId: typeof parsed.workflowRunId === "string" ? parsed.workflowRunId : "", maxScore: 10, questionImage: typeof parsed.questionImage === "string" ? parsed.questionImage : "", questionFileName: typeof parsed.questionFileName === "string" ? parsed.questionFileName : "", score: storedScore ?? extractScore(validMarkdown), questionType: typeof parsed.questionType === "string" ? parsed.questionType : "理论力学", difficulty: typeof parsed.difficulty === "number" ? parsed.difficulty : 3, knowledgePoints: Array.isArray(parsed.knowledgePoints) ? parsed.knowledgePoints.filter((item): item is string => typeof item === "string") : [], errorLocation: typeof parsed.errorLocation === "string" ? parsed.errorLocation : "", errorReason: typeof parsed.errorReason === "string" ? parsed.errorReason : "", improvement: typeof parsed.improvement === "string" ? parsed.improvement : "" };
  } catch {
    return null;
  }
}
