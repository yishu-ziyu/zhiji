import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Codex 的应用内浏览器以 127.0.0.1 打开本地预览；允许该开发来源接收
  // Next 的 HMR 资源，避免页面在刷新后只显示未加载样式的骨架。
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
