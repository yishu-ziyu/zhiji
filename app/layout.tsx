import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "项目理解",
  description: "授权本地文件夹，重建当前理解",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`h-full antialiased ${sans.variable}`}>
      <body className="min-h-screen bg-background text-foreground font-sans">
        {children}
        <Toaster
          position="bottom-right"
          theme="light"
          richColors
          closeButton
          toastOptions={{
            className: "font-sans",
          }}
        />
      </body>
    </html>
  );
}
