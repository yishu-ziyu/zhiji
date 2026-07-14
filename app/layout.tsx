import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FC-OPC · 知识工作台",
  description: "检索、知识卡片、待办行动",
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
