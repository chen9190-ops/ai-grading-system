"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  FileSearch,
  GraduationCap,
  Info,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import MobileShell from "../components/mobile/MobileShell";
import MobileTopBar from "../components/mobile/MobileTopBar";

type HistoryItem = {
  id: string;
  createdAt: string;
  problemFileName: string;
  answerFileName: string;
  resultPreview: string;
  score?: string;
};

const historyStorageKey = "ai-grading-history";
type SettingPanel = "account" | "notifications" | "about";

export default function ProfilePage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [referenceTime, setReferenceTime] = useState(0);
  const [activeSetting, setActiveSetting] = useState<SettingPanel | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    queueMicrotask(() => {
      setHistory(readHistory());
      setReferenceTime(Date.now());
      setLoaded(true);
    });
  }, []);

  const profile = useMemo(() => createLearningProfile(history), [history]);

  return (
    <MobileShell>
      <MobileTopBar title="智能学习档案" showBack={false} rightAction={<button type="button" onClick={() => setActiveSetting("account")} aria-label="设置" className="grid size-10 place-items-center rounded-full bg-white/75 text-slate-600 shadow-sm"><Settings className="size-5" /></button>} />

      <div className="space-y-5 px-4 py-5">
        <section className="relative overflow-hidden rounded-[24px] border border-white/80 bg-white/80 p-5 shadow-[0_10px_28px_rgba(30,41,59,.09)] backdrop-blur-md">
          <div className="absolute -right-12 -top-14 size-36 rounded-full bg-blue-100/50 blur-xl" />
          <div className="relative flex items-center gap-4">
            <div className="grid size-[70px] shrink-0 place-items-center rounded-full border-[3px] border-white bg-gradient-to-br from-[#34475f] to-[#0b1728] text-white shadow-[0_8px_20px_rgba(15,23,42,.2)]"><CircleUserRound className="size-10" strokeWidth={1.5} /></div>
            <div className="min-w-0"><h1 className="text-xl font-bold">张同学</h1><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><GraduationCap className="size-4 text-blue-600" />航空航天学院</p><p className="mt-1.5 text-[11px] text-slate-400">飞行器设计与工程</p></div>
          </div>
          <div className="relative mt-5 flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50/75 px-3 py-2.5"><span className="grid size-7 place-items-center rounded-full bg-blue-600 text-white"><CheckCircle2 className="size-4" /></span><div><p className="text-[9px] text-slate-400">学习状态</p><p className="mt-0.5 text-xs font-semibold text-blue-700">AI学习档案已建立</p></div><span className="ml-auto size-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.1)]" /></div>
        </section>

        <section>
          <SectionTitle eyebrow="Learning overview" title="学习数据概览" />
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={<FileSearch className="size-5" />} label="累计解析题目" value={loaded ? String(profile.uniqueProblems) : "--"} suffix="题" />
            <StatCard icon={<BookOpenCheck className="size-5" />} label="完成作业" value={loaded ? String(profile.completedRecords) : "--"} suffix="次" />
            <StatCard icon={<TrendingUp className="size-5" />} label="平均得分" value={loaded && profile.averageScore !== null ? String(profile.averageScore) : "--"} suffix={profile.averageScore !== null ? "分" : ""} />
            <StatCard icon={<Target className="size-5" />} label="正确率" value={loaded && profile.accuracy !== null ? String(profile.accuracy) : "--"} suffix={profile.accuracy !== null ? "%" : ""} />
          </div>
        </section>

        <section>
          <SectionTitle eyebrow="AI learning analysis" title="AI学习分析报告" />
          <div className="overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_90%_0%,rgba(59,130,246,.25),transparent_36%),linear-gradient(145deg,#17263a,#0d1828)] p-5 text-white shadow-[0_14px_32px_rgba(15,23,42,.22)]">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-500/20 text-blue-300"><BrainCircuit className="size-5" /></span><div><p className="text-sm font-bold">学习能力分析</p><p className="mt-0.5 text-[9px] uppercase tracking-[.14em] text-slate-400">Based on grading history</p></div></div>
            {profile.hasAnalysis ? (
              <div className="mt-5 space-y-1">
                <AnalysisRow label="优势" value={profile.strength || "高分作答步骤较为稳定"} tone="emerald" />
                <AnalysisRow label="薄弱" value={profile.weakness || "暂未形成明显薄弱知识点"} tone="orange" />
                <AnalysisRow label="建议" value={profile.suggestion} tone="blue" last />
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center"><Sparkles className="mx-auto size-6 text-blue-300" /><p className="mt-3 text-sm font-medium">分析数据正在积累</p><p className="mt-1.5 text-[11px] leading-5 text-slate-400">完成带有评分和知识点的 AI 解析后，这里将生成个性化学习分析。</p></div>
            )}
          </div>
        </section>

        <section>
          <SectionTitle eyebrow="Recent activity" title="最近学习记录" />
          <div className="overflow-hidden rounded-[24px] border border-white/80 bg-white/80 shadow-[0_8px_24px_rgba(30,41,59,.07)] backdrop-blur-md">
            {loaded && history.length ? history.slice(0, 5).map((item, index) => <div key={item.id} className={`flex items-center gap-3 px-4 py-3.5 ${index ? "border-t border-slate-100" : ""}`}><span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-blue-50 text-blue-600"><BookOpenCheck className="size-[18px]" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">完成 {item.problemFileName} 解析</p><p className="mt-1 text-[10px] text-slate-400">{formatRelativeDay(item.createdAt, referenceTime)} · {formatTime(item.createdAt)}</p></div>{item.score ? <span className="text-xs font-semibold text-blue-600">{item.score}</span> : null}</div>) : loaded ? <div className="px-6 py-10 text-center"><BookOpenCheck className="mx-auto size-7 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-500">暂无学习记录</p><p className="mt-1 text-[11px] text-slate-400">完成首次 AI 解析后会显示在这里。</p></div> : <div className="h-32 animate-pulse bg-white/50" />}
          </div>
        </section>

        <section>
          <SectionTitle eyebrow="Settings" title="设置与平台" />
          <div className="overflow-hidden rounded-[24px] border border-white/80 bg-white/80 shadow-[0_8px_24px_rgba(30,41,59,.07)] backdrop-blur-md">
            <SettingRow icon={<Settings className="size-[18px]" />} label="账号设置" onClick={() => setActiveSetting("account")} />
            <SettingRow icon={<Bell className="size-[18px]" />} label="通知设置" onClick={() => setActiveSetting("notifications")} />
            <SettingRow icon={<Info className="size-[18px]" />} label="关于平台" onClick={() => setActiveSetting("about")} last />
          </div>
        </section>
      </div>

      {activeSetting ? <SettingsDialog active={activeSetting} notificationsEnabled={notificationsEnabled} onNotificationsChange={setNotificationsEnabled} onClose={() => setActiveSetting(null)} /> : null}
    </MobileShell>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="mb-3 px-1"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-blue-600">{eyebrow}</p><h2 className="mt-0.5 text-lg font-bold">{title}</h2></div>;
}

function StatCard({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string; suffix: string }) {
  return <div className="rounded-[22px] border border-white/80 bg-white/80 p-4 shadow-[0_7px_20px_rgba(30,41,59,.07)] backdrop-blur-md"><div className="grid size-9 place-items-center rounded-[13px] bg-blue-50 text-blue-600">{icon}</div><p className="mt-4 text-2xl font-bold tracking-tight">{value}<span className="ml-1 text-[10px] font-medium text-slate-400">{suffix}</span></p><p className="mt-1 text-[10px] text-slate-400">{label}</p></div>;
}

function AnalysisRow({ label, value, tone, last = false }: { label: string; value: string; tone: "emerald" | "orange" | "blue"; last?: boolean }) {
  const tones = { emerald: "bg-emerald-400", orange: "bg-orange-400", blue: "bg-blue-400" };
  return <div className={`grid grid-cols-[46px_1fr] gap-3 py-3 ${last ? "" : "border-b border-white/10"}`}><span className="flex items-center gap-1.5 text-[10px] text-slate-400"><span className={`size-1.5 rounded-full ${tones[tone]}`} />{label}</span><p className="text-xs leading-5 text-slate-200">{value}</p></div>;
}

function SettingRow({ icon, label, onClick, last = false }: { icon: React.ReactNode; label: string; onClick: () => void; last?: boolean }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-4 text-left active:bg-blue-50/60 ${last ? "" : "border-b border-slate-100"}`}><span className="grid size-9 place-items-center rounded-xl bg-slate-50 text-slate-500">{icon}</span><span className="flex-1 text-sm font-medium">{label}</span><ChevronRight className="size-4 text-slate-300" /></button>;
}

function SettingsDialog({ active, notificationsEnabled, onNotificationsChange, onClose }: { active: SettingPanel; notificationsEnabled: boolean; onNotificationsChange: (enabled: boolean) => void; onClose: () => void }) {
  const titles = { account: "账号设置", notifications: "通知设置", about: "关于平台" };
  return <div role="dialog" aria-modal="true" aria-label={titles[active]} className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 sm:items-center"><div className="w-full max-w-[398px] rounded-[24px] bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">{titles[active]}</h2><button type="button" onClick={onClose} aria-label="关闭" className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-500"><X className="size-4" /></button></div>{active === "account" ? <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><p className="font-semibold text-slate-800">学生账号资料</p><p className="mt-2">姓名、学号和专业信息与学校档案关联。如需修改，请联系平台管理员。</p></div> : null}{active === "notifications" ? <label className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 p-4"><span><strong className="block text-sm">学习提醒</strong><span className="mt-1 block text-xs text-slate-500">接收批改完成和学习计划提醒</span></span><input type="checkbox" checked={notificationsEnabled} onChange={(event) => onNotificationsChange(event.target.checked)} className="size-5 accent-blue-600" /></label> : null}{active === "about" ? <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><p className="font-semibold text-slate-800">航空航天智能教学平台</p><p className="mt-2">提供 AI 作业批改、力学答疑、个性化训练和学习分析服务。</p><p className="mt-2 text-xs text-slate-400">Version 1.0</p></div> : null}</div></div>;
}

function createLearningProfile(history: HistoryItem[]) {
  const scored = history.map((item) => ({ item, score: parseScore(item.score) })).filter((entry): entry is { item: HistoryItem; score: number } => entry.score !== null);
  const averageScore = scored.length ? Math.round(scored.reduce((sum, entry) => sum + entry.score, 0) / scored.length) : null;
  const accuracy = scored.length ? Math.round((scored.filter((entry) => entry.score >= 60).length / scored.length) * 100) : null;
  const strongPoints = scored.filter((entry) => entry.score >= 80).flatMap((entry) => extractKnowledgePoints(entry.item.resultPreview));
  const weakPoints = scored.filter((entry) => entry.score < 60).flatMap((entry) => extractKnowledgePoints(entry.item.resultPreview));
  const strength = mostFrequent(strongPoints);
  const weakness = mostFrequent(weakPoints);

  return {
    uniqueProblems: new Set(history.map((item) => item.problemFileName)).size,
    completedRecords: history.length,
    averageScore,
    accuracy,
    strength,
    weakness,
    suggestion: weakness ? `建议加强“${weakness}”相关章节训练，并结合错题逐步复盘。` : "继续积累解析记录，保持分步骤检查与复盘习惯。",
    hasAnalysis: scored.length > 0,
  };
}

function parseScore(score?: string) {
  if (!score) return null;
  const values = score.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!Number.isFinite(values[0])) return null;
  if (Number.isFinite(values[1]) && values[1] > 0) return Math.round((values[0] / values[1]) * 100);
  return Math.min(100, values[0]);
}

function extractKnowledgePoints(text: string) {
  const match = text.match(/(?:知识点|涉及知识点|考查知识点)\s*[:：]\s*([^\n。]+)/i);
  if (!match?.[1]) return [];
  return match[1].replace(/[*#`]/g, "").split(/[、，,；;|/]/).map((item) => item.trim()).filter(Boolean).slice(0, 5);
}

function mostFrequent(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function readHistory(): HistoryItem[] {
  try {
    const stored = window.localStorage.getItem(historyStorageKey);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter(isHistoryItem).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];
  } catch {
    return [];
  }
}

function isHistoryItem(value: unknown): value is HistoryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<HistoryItem>;
  return typeof item.id === "string" && typeof item.createdAt === "string" && typeof item.problemFileName === "string" && typeof item.answerFileName === "string" && typeof item.resultPreview === "string" && (item.score === undefined || typeof item.score === "string");
}

function formatRelativeDay(value: string, referenceTime: number) {
  const date = new Date(value);
  const reference = new Date(referenceTime);
  const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((start - target) / 86400000);
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(date);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
