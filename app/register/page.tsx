"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, LoaderCircle, ShieldCheck } from "lucide-react";
import { withBasePath } from "@/lib/base-path";

const fields = [
  { name: "studentId", label: "学号", type: "text", autoComplete: "username" },
  { name: "name", label: "姓名", type: "text", autoComplete: "name" },
  { name: "email", label: "邮箱", type: "email", autoComplete: "email" },
  { name: "password", label: "密码", type: "password", autoComplete: "new-password" },
  { name: "confirmPassword", label: "确认密码", type: "password", autoComplete: "new-password" },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(fields.map(({ name }) => [name, String(form.get(name) ?? "")]));

    try {
      const response = await fetch(withBasePath("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(isRecord(payload) && typeof payload.error === "string" ? payload.error : "注册失败，请稍后重试");
      router.replace("/login");
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : "注册失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#E7EBF1] px-4 py-8 text-[#17243a] sm:py-12">
      <div className="mx-auto w-full max-w-lg border border-white/80 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,.13)] sm:p-8">
        <div className="grid size-12 place-items-center bg-[#0B4EA2] text-white"><GraduationCap className="size-6" /></div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[.16em] text-[#0B4EA2]">Student Registration</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#0B2545]">学生注册</h1>
        <p className="mt-2 text-sm text-slate-500">仅开放学生账号注册，教师和管理员账号由平台统一创建。</p>

        <form onSubmit={register} className="mt-7 space-y-4">
          {fields.map((field) => <label key={field.name} className="block text-sm font-semibold text-[#0B2545]">{field.label}<input required name={field.name} type={field.type} autoComplete={field.autoComplete} className="mt-2 h-12 w-full border border-[#B9C4D4] bg-white px-3 text-sm font-normal outline-none focus:border-[#0B4EA2] focus:ring-4 focus:ring-[#0B4EA2]/10" /></label>)}
          {error ? <p role="alert" className="border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p> : null}
          <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 bg-[#0B4EA2] text-sm font-semibold text-white disabled:bg-slate-400">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}{loading ? "正在创建账号..." : "创建学生账号"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">已有账号？ <Link href="/login" className="font-semibold text-[#0B4EA2] hover:underline">返回登录</Link></p>
      </div>
    </main>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
