import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI工程题智能批改系统",
  description: "一个用于工程题图片答案批改的前端演示系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
