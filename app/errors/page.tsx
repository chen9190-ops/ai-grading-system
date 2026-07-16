"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import MobileShell from "../components/mobile/MobileShell";
import MobileTopBar from "../components/mobile/MobileTopBar";
import { withBasePath } from "@/lib/base-path";
import {
  AlertCircle,
  BookOpen,
  Bot,
  ChevronRight,
  FileImage,
  FileText,
  Filter,
  ImageIcon,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from "lucide-react";

type HistoryItem = {
  id: string;
  createdAt: string;
  workflowRunId?: string;
  problemFileName: string;
  answerFileName: string;
  resultPreview: string;
  score?: string;
};

type ErrorGroup = {
  latest: HistoryItem;
  attempts: number;
};

type DetailData = {
  report: string;
  loading: boolean;
  error: string;
};

const historyStorageKey = "ai-grading-history";
const tabs = ["全部", "知识点", "题型", "时间"] as const;
type Tab = (typeof tabs)[number];

export default function ErrorsPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("全部");
  const [selected, setSelected] = useState<ErrorGroup | null>(null);
  const [detail, setDetail] = useState<DetailData>({ report: "", loading: false, error: "" });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [recentOnly, setRecentOnly] = useState(false);
  const [referenceTime, setReferenceTime] = useState(0);
  const touchStartY = useRef(0);

  useEffect(() => {
    queueMicrotask(() => {
      setHistory(readHistory());
      setReferenceTime(Date.now());
      setLoaded(true);
    });
  }, []);

  const errors = useMemo(() => {
    const wrongItems = history.filter(isWrongAnswer);
    const grouped = new Map<string, ErrorGroup>();

    wrongItems.forEach((item) => {
      const current = grouped.get(item.problemFileName);
      if (!current) {
        grouped.set(item.problemFileName, { latest: item, attempts: 1 });
        return;
      }

      current.attempts += 1;
      if (new Date(item.createdAt).getTime() > new Date(current.latest.createdAt).getTime()) {
        current.latest = item;
      }
    });

    let nextItems = [...grouped.values()];
    if (recentOnly) {
      const sevenDaysAgo = referenceTime - 7 * 24 * 60 * 60 * 1000;
      nextItems = nextItems.filter((item) => new Date(item.latest.createdAt).getTime() >= sevenDaysAgo);
    }

    if (activeTab === "时间") {
      return nextItems.sort((a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime());
    }

    if (activeTab === "知识点") {
      return nextItems.sort((a, b) => extractField(a.latest.resultPreview, ["知识点", "涉及知识点"]).localeCompare(extractField(b.latest.resultPreview, ["知识点", "涉及知识点"]), "zh-CN"));
    }

    if (activeTab === "题型") {
      return nextItems.sort((a, b) => extractField(a.latest.resultPreview, ["错误类型", "题型"]).localeCompare(extractField(b.latest.resultPreview, ["错误类型", "题型"]), "zh-CN"));
    }

    return nextItems.sort((a, b) => b.attempts - a.attempts);
  }, [activeTab, history, recentOnly, referenceTime]);

  function refresh() {
    setIsRefreshing(true);
    setPullDistance(0);
    window.setTimeout(() => {
      setHistory(readHistory());
      setReferenceTime(Date.now());
      setIsRefreshing(false);
    }, 500);
  }

  function handleTouchMove(event: React.TouchEvent) {
    if (window.scrollY > 0) return;
    const distance = Math.max(0, Math.min(84, event.touches[0].clientY - touchStartY.current));
    setPullDistance(distance);
  }

  function handleTouchEnd() {
    if (pullDistance >= 58) refresh();
    else setPullDistance(0);
  }

  async function openDetail(group: ErrorGroup) {
    setSelected(group);
    setDetail({ report: group.latest.resultPreview, loading: Boolean(group.latest.workflowRunId), error: "" });

    if (!group.latest.workflowRunId) return;

    try {
      const response = await fetch(withBasePath(`/api/grade/history?id=${encodeURIComponent(group.latest.workflowRunId)}`));
      const payload = await response.json();
      if (!response.ok || typeof payload?.result !== "string") throw new Error("unavailable");
      setDetail({ report: payload.result, loading: false, error: "" });
    } catch {
      setDetail((current) => ({ ...current, loading: false, error: "完整 AI 分析暂时无法获取，当前显示本地摘要。" }));
    }
  }

  return (
    <MobileShell>
      <div onTouchStart={(event) => { touchStartY.current = event.touches[0].clientY; }} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <MobileTopBar title="AI错题本" rightAction={<button type="button" onClick={() => setFilterOpen((value) => !value)} aria-label="筛选" className={`grid size-10 place-items-center rounded-full bg-white/75 shadow-sm ${filterOpen || recentOnly ? "text-blue-600" : "text-slate-600"}`}><Filter className="size-5" /></button>} />
        <div className="sticky top-[65px] z-20 grid grid-cols-4 border-b border-white/70 bg-[#edf0f3]/85 px-4 backdrop-blur-xl">{tabs.map((tab) => <button type="button" key={tab} onClick={() => setActiveTab(tab)} className={`relative pb-3 pt-2 text-xs font-medium ${activeTab === tab ? "text-blue-600" : "text-slate-400"}`}>{tab}{activeTab === tab ? <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-blue-600" /> : null}</button>)}</div>

        {filterOpen ? <div className="absolute right-4 top-[106px] z-40 w-48 rounded-2xl border border-white bg-white/95 p-3 shadow-xl backdrop-blur-xl"><div className="flex items-center justify-between"><p className="text-xs font-bold">筛选错题</p><button type="button" onClick={() => setFilterOpen(false)}><X className="size-4 text-slate-400" /></button></div><label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-xs"><span>仅最近 7 天</span><input type="checkbox" checked={recentOnly} onChange={(event) => setRecentOnly(event.target.checked)} className="accent-blue-600" /></label></div> : null}

        <div aria-hidden className="grid overflow-hidden place-items-center text-blue-600 transition-[height]" style={{ height: `${pullDistance || (isRefreshing ? 44 : 0)}px` }}><div className="flex items-center gap-2 text-xs"><RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />{isRefreshing ? "正在刷新" : pullDistance >= 58 ? "松开刷新" : "下拉刷新"}</div></div>

        <div className="space-y-4 px-4 py-4">
          <div className="flex items-end justify-between px-1"><div><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-blue-600">Mistake collection</p><h2 className="mt-1 text-xl font-bold">错题复盘</h2></div><p className="text-[11px] text-slate-400">{loaded ? `${errors.length} 道错题` : "读取中"}</p></div>

          {loaded && errors.length ? (
            <div className="space-y-3">
              {errors.map((group) => {
                const item = group.latest;
                const errorType = extractField(item.resultPreview, ["错误类型", "错误分类"]);
                const points = extractTags(item.resultPreview);
                return <article key={item.id} onClick={() => openDetail(group)} className="group cursor-pointer rounded-[22px] border border-white/80 bg-white/82 p-3 shadow-[0_8px_24px_rgba(30,41,59,.08)] backdrop-blur-md transition duration-200 active:scale-[.98] active:bg-blue-50/70"><div className="flex gap-3"><div className="grid size-[76px] shrink-0 place-items-center overflow-hidden rounded-[16px] bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400"><FileImage className="size-7" /></div><div className="min-w-0 flex-1"><div className="flex items-start gap-2"><h3 className="line-clamp-2 flex-1 text-sm font-bold leading-5">{item.problemFileName}</h3><ChevronRight className="mt-0.5 size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" /></div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500"><span>错误次数：<b className="text-orange-500">{group.attempts}次</b></span><span>错误类型：<b className="font-medium text-slate-700">{errorType || "查看分析"}</b></span></div>{points.length ? <div className="mt-2 flex flex-wrap gap-1.5">{points.map((point) => <span key={point} className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-medium text-blue-600">{point}</span>)}</div> : null}</div></div><div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-[10px] text-slate-400">{formatTime(item.createdAt)}</span><button type="button" onClick={(event) => { event.stopPropagation(); openDetail(group); }} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white shadow-[0_5px_12px_rgba(37,99,235,.22)]"><RotateCcw className="size-3.5" />重新训练</button></div></article>;
              })}
            </div>
          ) : loaded ? (
            <div className="rounded-[28px] border border-white/80 bg-white/75 px-6 py-16 text-center shadow-[0_10px_30px_rgba(30,41,59,.07)] backdrop-blur-md"><div className="mx-auto grid size-16 place-items-center rounded-[22px] bg-blue-50 text-blue-500"><Sparkles className="size-7" /></div><h3 className="mt-5 text-base font-bold">暂无错题</h3><p className="mt-2 text-sm text-slate-400">继续保持练习，每一次思考都在进步。</p><Link href="/" className="mt-6 inline-flex h-11 items-center rounded-2xl bg-blue-600 px-5 text-xs font-semibold text-white shadow-md">去拍照解析</Link></div>
          ) : <div className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-[22px] bg-white/60" />)}</div>}
        </div>

        {selected ? <DetailSheet group={selected} detail={detail} onClose={() => setSelected(null)} recommendations={errors.filter((item) => item.latest.id !== selected.latest.id).slice(0, 2)} onSelect={openDetail} /> : null}
      </div>
    </MobileShell>
  );
}

function DetailSheet({ group, detail, onClose, recommendations, onSelect }: { group: ErrorGroup; detail: DetailData; onClose: () => void; recommendations: ErrorGroup[]; onSelect: (group: ErrorGroup) => void }) {
  const report = detail.report;
  return <div className="fixed inset-0 z-50 bg-slate-950/35" role="dialog" aria-modal="true" aria-label="错题详情"><button type="button" aria-label="关闭详情" onClick={onClose} className="absolute inset-0" /><section className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[92vh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[30px] bg-[#f3f5f7] shadow-2xl"><div className="shrink-0 border-b border-slate-200/70 bg-white/80 px-4 pb-3 pt-2 backdrop-blur-xl"><div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300" /><div className="flex items-center justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-blue-600">Mistake detail</p><h2 className="mt-0.5 text-base font-bold">错题详情</h2></div><button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-slate-100"><X className="size-4" /></button></div></div><div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-8"><DetailCard icon={<ImageIcon className="size-4" />} title="原题图片"><ImagePlaceholder label={group.latest.problemFileName} /></DetailCard><DetailCard icon={<FileText className="size-4" />} title="我的答案"><ImagePlaceholder label={group.latest.answerFileName} /></DetailCard><DetailCard icon={<Bot className="size-4" />} title="AI分析">{detail.loading ? <div className="flex items-center gap-2 py-3 text-xs text-blue-600"><RefreshCw className="size-4 animate-spin" />正在加载完整分析</div> : <p className="whitespace-pre-wrap text-xs leading-6 text-slate-600">{report || "暂无分析内容"}</p>}{detail.error ? <p className="mt-2 text-[11px] text-orange-500">{detail.error}</p> : null}</DetailCard><DetailCard icon={<AlertCircle className="size-4" />} title="错误原因"><p className="text-xs leading-6 text-slate-600">{extractField(report, ["错误原因", "原因分析", "错误类型"]) || "完整报告中暂未提取到明确错误原因。"}</p></DetailCard><DetailCard icon={<Target className="size-4" />} title="正确方法"><p className="whitespace-pre-wrap text-xs leading-6 text-slate-600">{extractField(report, ["正确方法", "标准解", "标准答案", "改进建议"]) || "完整报告中暂未提取到正确方法。"}</p></DetailCard><DetailCard icon={<BookOpen className="size-4" />} title="类似题推荐">{recommendations.length ? <div className="space-y-2">{recommendations.map((item) => <button type="button" key={item.latest.id} onClick={() => onSelect(item)} className="flex w-full items-center rounded-xl bg-slate-50 px-3 py-3 text-left text-xs font-medium"><span className="line-clamp-1 flex-1">{item.latest.problemFileName}</span><ChevronRight className="size-4 text-slate-400" /></button>)}</div> : <p className="text-xs text-slate-400">暂无其他真实错题可推荐。</p>}</DetailCard></div></section></div>;
}

function DetailCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <div className="rounded-[20px] border border-white bg-white/85 p-4 shadow-[0_6px_18px_rgba(30,41,59,.06)]"><div className="mb-3 flex items-center gap-2 text-blue-600">{icon}<h3 className="text-sm font-bold text-slate-800">{title}</h3></div>{children}</div>;
}

function ImagePlaceholder({ label }: { label: string }) {
  return <div className="grid min-h-28 place-items-center rounded-2xl bg-slate-50 px-4 text-center text-slate-400"><div><FileImage className="mx-auto size-7" /><p className="mt-2 break-all text-[11px]">{label}</p><p className="mt-1 text-[9px]">历史记录未保存图片本体</p></div></div>;
}

function readHistory(): HistoryItem[] {
  try {
    const value = window.localStorage.getItem(historyStorageKey);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter(isHistoryItem) : [];
  } catch {
    return [];
  }
}

function isHistoryItem(value: unknown): value is HistoryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<HistoryItem>;
  return typeof item.id === "string" && typeof item.createdAt === "string" && typeof item.problemFileName === "string" && typeof item.answerFileName === "string" && typeof item.resultPreview === "string" && (item.score === undefined || typeof item.score === "string") && (item.workflowRunId === undefined || typeof item.workflowRunId === "string");
}

function isWrongAnswer(item: HistoryItem) {
  if (!item.score) return false;
  const values = item.score.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!Number.isFinite(values[0])) return false;
  if (Number.isFinite(values[1]) && values[1] > 0) return values[0] < values[1];
  return values[0] < 100;
}

function extractField(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`(?:^|\\s)(?:#{1,6}\\s*)?(?:\\*\\*)?${escaped}(?:\\*\\*)?\\s*[:：]\\s*([^\\n。]+)`, "i"));
    if (match?.[1]) return match[1].replace(/[*#`]/g, "").trim().slice(0, 240);
  }
  return "";
}

function extractTags(text: string) {
  const field = extractField(text, ["知识点", "涉及知识点", "考查知识点"]);
  return field.split(/[、，,；;|/]/).map((item) => item.trim()).filter(Boolean).slice(0, 3);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
