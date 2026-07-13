import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FC-OPC · 交付运营助手",
  description: "一人公司效率 Agent · 客户承诺到交付确认",
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
