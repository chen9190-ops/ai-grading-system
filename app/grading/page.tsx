"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MobileShell from "../components/mobile/MobileShell";
import MobileTopBar from "../components/mobile/MobileTopBar";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ImageIcon,
  Lightbulb,
  Send,
  Share2,
  Sparkles,
  Target,
} from "lucide-react";

type GradingResult = {
  questionImage: string;
  questionFileName: string;
  result: string;
  score: string;
  questionType: string;
  difficulty: number;
  knowledgePoints: string[];
  errorLocation: string;
  errorReason: string;
  improvement: string;
};

type AnalysisStep = {
  title: string;
  content: string;
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

  const steps = useMemo(() => createAnalysisSteps(data?.result ?? ""), [data]);
  const numericScore = getNumericScore(data?.score ?? "");
  const isCorrect = numericScore === null ? null : numericScore >= 60;

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

  const knowledgePoints = data.knowledgePoints.length
    ? data.knowledgePoints
    : ["力矩平衡", "受力分析", "约束反力"];

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
                <div className="mt-4"><p className="text-[10px] text-slate-400">涉及知识点</p><div className="mt-2 flex flex-wrap gap-2">{knowledgePoints.map((point) => <span key={point} className="rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-medium text-blue-600">{point}</span>)}</div></div>
              </div>
            </div>
          </section>

          <section>
            <SectionTitle eyebrow="AI analysis" title="AI解析步骤" />
            <div className="space-y-3">
              {steps.map((step, index) => (
                <details key={step.title} open={index === 0} className="group overflow-hidden rounded-[20px] border border-white/80 bg-white/80 shadow-[0_7px_20px_rgba(30,41,59,.07)] backdrop-blur-md">
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-[0_5px_12px_rgba(37,99,235,.28)]">{index + 1}</span>
                    <div className="flex-1"><p className="text-[10px] font-medium text-blue-500">步骤{index + 1}</p><h3 className="mt-0.5 text-sm font-bold">{step.title}</h3></div>
                    <ChevronDown className="size-5 text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3"><ResultMarkdown content={step.content} /></div>
                </details>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle eyebrow="Grading result" title="批改结果" />
            <div className="overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_92%_5%,rgba(59,130,246,.28),transparent_35%),linear-gradient(145deg,#17263a,#0d1828)] p-5 text-white shadow-[0_14px_32px_rgba(15,23,42,.22)]">
              <div className="flex items-center justify-between">
                <div><p className="text-[10px] uppercase tracking-[.16em] text-slate-400">综合评分</p><p className="mt-2"><strong className="text-4xl">{data.score || "--"}</strong>{data.score && !data.score.includes("/") ? <span className="ml-1 text-sm text-slate-400">分</span> : null}</p></div>
                <div className={`grid size-16 place-items-center rounded-full border ${isCorrect === false ? "border-orange-400/40 bg-orange-400/10 text-orange-300" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"}`}>{isCorrect === false ? <AlertCircle className="size-8" /> : <CheckCircle2 className="size-8" />}</div>
              </div>
              <div className="mt-5 border-t border-white/10 pt-4"><p className="text-sm font-semibold">{isCorrect === false ? "本题存在需要修正的步骤" : "整体作答完成良好"}</p><p className="mt-1.5 text-xs leading-5 text-slate-400">AI 已完成题目理解、计算过程与最终答案核验，请结合下方纠错建议复习。</p></div>
            </div>
          </section>

          <section>
            <SectionTitle eyebrow="Error analysis" title="AI纠错" />
            <div className="rounded-[24px] border border-white/80 bg-white/85 p-4 shadow-[0_9px_26px_rgba(30,41,59,.08)] backdrop-blur-md">
              <CorrectionItem icon={<Target className="size-4" />} label="错误位置" value={data.errorLocation || "暂未识别到明确错误位置"} tone="red" />
              <CorrectionItem icon={<AlertCircle className="size-4" />} label="错误原因" value={data.errorReason || "请重点核对公式代入与约束条件"} tone="orange" />
              <CorrectionItem icon={<Lightbulb className="size-4" />} label="改进建议" value={data.improvement || "重新梳理解题条件，并按步骤检查计算过程"} tone="blue" last />
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

function CorrectionItem({ icon, label, value, tone, last = false }: { icon: React.ReactNode; label: string; value: string; tone: "red" | "orange" | "blue"; last?: boolean }) {
  const tones = { red: "bg-red-50 text-red-500", orange: "bg-orange-50 text-orange-500", blue: "bg-blue-50 text-blue-600" };
  return <div className={`flex gap-3 py-3 ${last ? "" : "border-b border-slate-100"}`}><div className={`grid size-9 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>{icon}</div><div><p className="text-[10px] text-slate-400">{label}</p><p className="mt-1 text-sm leading-6 text-slate-700">{value}</p></div></div>;
}

function ResultMarkdown({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({ children }) => <p className="my-2 text-[13px] leading-6 text-slate-600">{children}</p>, ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 text-[13px] leading-6 text-slate-600">{children}</ul>, ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 text-[13px] leading-6 text-slate-600">{children}</ol>, h1: ({ children }) => <h4 className="my-2 text-sm font-bold">{children}</h4>, h2: ({ children }) => <h4 className="my-2 text-sm font-bold">{children}</h4>, h3: ({ children }) => <h4 className="my-2 text-sm font-bold">{children}</h4>, code: ({ children }) => <code className="rounded bg-slate-100 px-1 text-blue-700">{children}</code> }}>{content}</ReactMarkdown>;
}

function readGradingResult(): GradingResult | null {
  try {
    const storedValue = window.sessionStorage.getItem(gradingResultStorageKey);
    if (!storedValue) return null;
    const parsed = JSON.parse(storedValue) as Partial<GradingResult>;
    if (typeof parsed.result !== "string") return null;
    return { questionImage: typeof parsed.questionImage === "string" ? parsed.questionImage : "", questionFileName: typeof parsed.questionFileName === "string" ? parsed.questionFileName : "", result: parsed.result, score: typeof parsed.score === "string" ? parsed.score : "", questionType: typeof parsed.questionType === "string" ? parsed.questionType : "理论力学", difficulty: typeof parsed.difficulty === "number" ? parsed.difficulty : 3, knowledgePoints: Array.isArray(parsed.knowledgePoints) ? parsed.knowledgePoints.filter((item): item is string => typeof item === "string") : [], errorLocation: typeof parsed.errorLocation === "string" ? parsed.errorLocation : "", errorReason: typeof parsed.errorReason === "string" ? parsed.errorReason : "", improvement: typeof parsed.improvement === "string" ? parsed.improvement : "" };
  } catch {
    return null;
  }
}

function createAnalysisSteps(result: string): AnalysisStep[] {
  const titles = ["题目理解", "建立模型", "计算过程", "最终答案"];
  const sections = result.split(/(?=^#{1,4}\s+)/m).map((item) => item.trim()).filter(Boolean);
  const keywords = [["题目", "识别", "已知"], ["模型", "受力", "方程", "思路"], ["计算", "求解", "步骤", "过程"], ["答案", "结果", "结论", "评分"]];
  const unused = [...sections];

  return titles.map((title, index) => {
    const matchIndex = unused.findIndex((section) => keywords[index].some((keyword) => section.includes(keyword)));
    const content = matchIndex >= 0 ? unused.splice(matchIndex, 1)[0] : unused.shift();
    return { title, content: content || fallbackStepContent(index) };
  });
}

function fallbackStepContent(index: number) {
  return ["读取题目条件，明确已知量、未知量与求解目标。", "根据题意建立物理或数学模型，确定约束关系。", "代入已知条件并逐步计算，检查公式与单位。", "汇总计算结果，并与学生答案进行核验。"][index];
}

function getNumericScore(score: string) {
  const values = score.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];

  if (!Number.isFinite(values[0])) return null;
  if (Number.isFinite(values[1]) && values[1] > 0) return (values[0] / values[1]) * 100;
  return values[0];
}
