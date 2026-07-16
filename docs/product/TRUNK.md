# 主线（Trunk）

**唯一开发目录：** `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot`  
**唯一分支：** `main`  
**当前 tip：** `d4eec430`（产品基线 c264 线 + Wave A 领域/轨迹 + correction）

## 试用

```bash
cd /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot
node node_modules/next/dist/bin/next dev --port 3331
# 浏览器：http://127.0.0.1:3331/track/knowledge/mvp
# 夹具：/tmp/mvp-v0-g6-d50-fixture
```

## 约定（Owner）

- 不新开并行 feature 分支、不新开 treehouse 施工树（除非 Owner 明确改口）。
- 改代码只在本目录 `main` 上。
