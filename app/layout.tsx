import type { Metadata } from "next";
import { Toaster } from "sonner";
import { LocalSessionBootstrap } from "./components/LocalSessionBootstrap";
import "./globals.css";

/**
 * Offline / desktop packaging must not depend on Google Fonts network fetch.
 * Prefer Plus Jakarta when present on the host; otherwise system UI fonts.
 * Workbench visual tokens elsewhere still reference --font-plus-jakarta.
 */
const fontVariableClass = "font-desktop-shell";

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
    <html
      lang="zh-CN"
      className={`h-full antialiased ${fontVariableClass}`}
      style={
        {
          ["--font-plus-jakarta" as string]:
            '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
        } as React.CSSProperties
      }
    >
      <body className="min-h-screen bg-background text-foreground font-sans">
        <LocalSessionBootstrap />
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
