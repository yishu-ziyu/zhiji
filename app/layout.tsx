import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FC-OPC iBot",
  description: "AI Agent Platform for One Person Company",
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
