"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  Eye,
  EyeOff,
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import type { UserRole } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("student");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });
      const payload = await response.json();

      if (!response.ok || typeof payload?.redirectTo !== "string") {
        throw new Error(typeof payload?.error === "string" ? payload.error : "登录失败，请稍后重试");
      }

      router.replace(payload.redirectTo);
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#E7EBF1] text-[#17243a]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(480px,.95fr)]">
        <section className="relative hidden overflow-hidden bg-[#07162A] lg:block">
          <Image src="/assets/astronaut-ai-assistant.png" alt="航空航天智能教学平台" fill priority sizes="55vw" className="object-cover object-[58%_35%] opacity-70" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,15,29,.35),rgba(4,15,29,.68)),linear-gradient(0deg,rgba(4,15,29,.96),transparent_70%)]" />
          <div className="relative flex h-full flex-col justify-between p-10 xl:p-14"><div><div className="grid size-14 place-items-center border border-blue-300/25 bg-blue-400/15 text-sm font-bold text-white backdrop-blur-md">HUST</div><p className="mt-6 text-xs font-semibold uppercase tracking-[.2em] text-blue-300">Aerospace Intelligent Education</p><h1 className="mt-3 max-w-xl text-4xl font-semibold leading-tight text-white xl:text-5xl">航空航天<br />智能教学平台</h1><p className="mt-5 max-w-lg text-sm leading-7 text-slate-300">面向航空航天学院学生与教师的 AI 批改、学情分析和个性化训练平台。</p></div><div className="grid max-w-xl grid-cols-3 gap-px overflow-hidden border border-white/10 bg-white/10">{[[BookOpenCheck,"智能批改"],[Users,"学情分析"],[ShieldCheck,"角色权限"]].map(([Icon,label]) => { const FeatureIcon = Icon as typeof BookOpenCheck; return <div key={label as string} className="bg-[#07162A]/70 p-4 text-white backdrop-blur-md"><FeatureIcon className="size-5 text-blue-300" /><p className="mt-2 text-xs">{label as string}</p></div>; })}</div></div>
        </section>

        <section className="relative flex items-center justify-center overflow-hidden px-4 py-8 sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_4%,rgba(255,255,255,.95)_0_3%,transparent_4%),radial-gradient(circle_at_14%_20%,rgba(148,163,184,.12)_0_8%,transparent_9%),linear-gradient(155deg,#edf0f3,#f8f9fa_55%,#e7eaee)]" />
          <div className="relative w-full max-w-[460px]">
            <div className="mb-7 lg:hidden"><div className="grid size-12 place-items-center bg-[#0B4EA2] text-xs font-bold text-white">HUST</div><h1 className="mt-4 text-2xl font-bold">航空航天智能教学平台</h1><p className="mt-2 text-xs text-slate-500">Aerospace Intelligent Education</p></div>

            <div className="border border-white/80 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,.13)] backdrop-blur-xl sm:p-8">
              <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#0B4EA2]">Account Login</p><h2 className="mt-2 text-2xl font-semibold text-[#0B2545]">用户登录</h2><p className="mt-2 text-sm text-slate-500">请选择身份并登录对应工作空间。</p></div>

              <div className="mt-7 grid grid-cols-2 gap-3">{([{ value: "student", label: "学生", description: "学习与AI批改", icon: GraduationCap }, { value: "teacher", label: "教师", description: "教学管理平台", icon: Users }] as const).map(({ value, label, description, icon: Icon }) => <button type="button" key={value} onClick={() => { setRole(value); setError(""); }} className={`flex items-center gap-3 border p-3 text-left transition ${role === value ? "border-[#0B4EA2] bg-[#EAF2FC] shadow-[inset_0_-2px_0_#0B4EA2]" : "border-[#D8DEE8] bg-white hover:border-[#8EAED6]"}`}><span className={`grid size-10 shrink-0 place-items-center ${role === value ? "bg-[#0B4EA2] text-white" : "bg-slate-100 text-slate-500"}`}><Icon className="size-5" /></span><span><strong className="block text-sm text-[#0B2545]">{label}</strong><span className="mt-0.5 block text-[10px] text-slate-500">{description}</span></span></button>)}</div>

              <form onSubmit={login} className="mt-6 space-y-4">
                <label className="block text-sm font-semibold text-[#0B2545]">用户名<div className="relative mt-2"><UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input required autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="请输入用户名" className="h-12 w-full border border-[#B9C4D4] bg-white pl-10 pr-3 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-[#0B4EA2] focus:ring-4 focus:ring-[#0B4EA2]/10" /></div></label>
                <label className="block text-sm font-semibold text-[#0B2545]">密码<div className="relative mt-2"><LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input required autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" className="h-12 w-full border border-[#B9C4D4] bg-white pl-10 pr-11 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-[#0B4EA2] focus:ring-4 focus:ring-[#0B4EA2]/10" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "隐藏密码" : "显示密码"} className="absolute right-0 top-0 grid size-12 place-items-center text-slate-400 hover:text-[#0B4EA2]">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>

                {error ? <p role="alert" className="border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p> : null}

                <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 bg-[#0B4EA2] text-sm font-semibold text-white shadow-sm transition hover:bg-[#163A70] focus:outline-none focus:ring-4 focus:ring-[#0B4EA2]/15 disabled:cursor-wait disabled:bg-slate-400">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}{loading ? "正在验证身份..." : `登录${role === "teacher" ? "教师端" : "学生端"}`}</button>
              </form>

              <div className="mt-5 border-t border-[#E7EBF1] pt-4 text-[11px] leading-5 text-slate-400"><p>本地演示账号：学生 <code>student / student123</code>，教师 <code>teacher / teacher123</code>。</p><p className="mt-1">部署时请通过环境变量替换账号并设置独立 AUTH_SECRET。</p></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
