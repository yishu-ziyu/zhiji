import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FC-OPC · 知识闭环",
  description: "知识工作者效率 Agent · 检索 · 沉淀 · 行动",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-screen bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
