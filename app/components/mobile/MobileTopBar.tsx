"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type MobileTopBarProps = {
  title: string;
  showBack?: boolean;
  rightAction?: ReactNode;
  centerContent?: ReactNode;
  className?: string;
};

export default function MobileTopBar({ title, showBack = true, rightAction, centerContent, className = "" }: MobileTopBarProps) {
  const router = useRouter();

  return (
    <header className={`sticky top-0 z-30 border-b border-white/55 bg-[#dce1e6]/72 px-4 py-3 shadow-[0_5px_18px_rgba(71,85,105,.06)] backdrop-blur-xl ${className}`}>
      <div className="grid grid-cols-[72px_1fr_72px] items-center">
        <div>{showBack ? <button type="button" onClick={() => router.back()} aria-label="返回" className="grid size-10 place-items-center rounded-full bg-white/75 text-slate-700 shadow-sm"><ArrowLeft className="size-5" /></button> : null}</div>
        {centerContent ?? <h1 className="text-center text-[16px] font-bold">{title}</h1>}
        <div className="flex justify-end gap-1">{rightAction}</div>
      </div>
    </header>
  );
}
