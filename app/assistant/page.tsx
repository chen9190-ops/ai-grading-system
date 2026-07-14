import Image from "next/image";
import Link from "next/link";
import MobileShell from "../components/mobile/MobileShell";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  FileSearch,
  GraduationCap,
  MessagesSquare,
  Route,
  Sigma,
  Sparkles,
} from "lucide-react";

const capabilities = [
  { title: "知识问答", description: "专业课程问题解答", icon: MessagesSquare },
  { title: "公式推导", description: "力学公式详细推导", icon: Sigma },
  { title: "概念解释", description: "深入理解知识点", icon: BrainCircuit },
  { title: "错题分析", description: "分析错误原因", icon: FileSearch },
  { title: "学习建议", description: "生成复习计划", icon: Route },
  { title: "资料推荐", description: "推荐教材章节", icon: GraduationCap },
];

export default function AssistantPage() {
  return (
    <MobileShell className="pb-40">
        <header className="px-5 pb-4 pt-5">
          <p className="text-[9px] font-semibold uppercase tracking-[.2em] text-blue-600">Aerospace learning assistant</p>
          <div className="mt-1 flex items-center gap-2"><Sparkles className="size-5 text-blue-600" /><h1 className="text-[22px] font-bold tracking-tight">AI助手中心</h1></div>
        </header>

        <div className="space-y-6 px-4">
          <section className="relative min-h-[294px] overflow-hidden rounded-[28px] bg-[#09182b] text-white shadow-[0_18px_42px_rgba(15,23,42,.25)]">
            <Image src="/assets/astronaut-ai-assistant.png" alt="穿白色宇航服、佩戴蓝色透明头盔的航空航天 AI 助手" fill priority sizes="(max-width: 430px) 100vw, 430px" className="object-cover object-[62%_34%] opacity-90" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,15,29,.98)_0%,rgba(5,15,29,.84)_42%,rgba(5,15,29,.12)_78%),linear-gradient(0deg,rgba(5,15,29,.72),transparent_55%)]" />
            <div className="relative flex min-h-[294px] max-w-[68%] flex-col p-5">
              <div className="flex items-center gap-2 text-[10px] text-blue-200"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-70" /><span className="relative size-2 rounded-full bg-blue-400" /></span>AI 助教在线</div>
              <h2 className="mt-4 text-xl font-bold leading-8">你好，我是你的<br />航空航天 AI 助教</h2>
              <p className="mt-3 text-[11px] leading-5 text-slate-300">小宇航员 AI 助手，为你的专业学习提供清晰、严谨的思路。</p>
              <div className="mt-auto grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/10 pt-4 text-[10px] text-slate-300">{["解答力学问题", "分析错题", "推导公式", "制定学习计划"].map((item) => <span key={item} className="flex items-center gap-1.5"><span className="size-1 rounded-full bg-blue-400" />{item}</span>)}</div>
            </div>
          </section>

          <section>
            <div className="mb-3 px-1"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-blue-600">AI capabilities</p><div className="mt-0.5 flex items-end justify-between"><h2 className="text-lg font-bold">选择学习服务</h2><span className="text-[10px] text-slate-400">6 项能力</span></div></div>
            <div className="grid grid-cols-2 gap-3">{capabilities.map(({ title, description, icon: Icon }, index) => <Link href="/chat" key={title} className="group min-h-[138px] rounded-[22px] border border-white/80 bg-white/80 p-4 shadow-[0_8px_22px_rgba(30,41,59,.07)] backdrop-blur-md transition duration-200 active:scale-[.97] active:bg-blue-50"><div className={`grid size-10 place-items-center rounded-[14px] ${index % 3 === 0 ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600"}`}><Icon className="size-5" strokeWidth={1.8} /></div><div className="mt-4 flex items-start justify-between gap-1"><div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-[10px] leading-4 text-slate-400">{description}</p></div><ArrowRight className="mt-0.5 size-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" /></div></Link>)}</div>
          </section>
        </div>

        <div className="fixed inset-x-0 bottom-[70px] z-30 mx-auto w-full max-w-[430px] px-4"><Link href="/chat" className="flex h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-[#1686f7] to-[#0753bc] text-sm font-semibold text-white shadow-[0_12px_26px_rgba(8,112,229,.3)]"><Bot className="size-5" />开始提问<ArrowRight className="size-4" /></Link></div>
    </MobileShell>
  );
}
