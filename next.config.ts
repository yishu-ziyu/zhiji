import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Codex 的应用内浏览器以 127.0.0.1 打开本地预览；允许该开发来源接收
  // Next 的 HMR 资源，避免页面在刷新后只显示未加载样式的骨架。
  allowedDevOrigins: ["127.0.0.1"],
  // @parcel/watcher is a native Node module used by project-memory observer.
  // Keep it (and platform optional deps) external so Turbopack does not try to
  // bundle @parcel/watcher-darwin-arm64 into the server graph (500 on source-grants).
  serverExternalPackages: [
    "@parcel/watcher",
    "@parcel/watcher-darwin-arm64",
    "@parcel/watcher-darwin-x64",
    "@parcel/watcher-linux-x64-glibc",
    "@parcel/watcher-linux-arm64-glibc",
    "@parcel/watcher-win32-x64",
  ],
};

export default nextConfig;
