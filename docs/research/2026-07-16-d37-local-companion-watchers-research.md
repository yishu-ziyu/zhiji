# D-37：本地 companion / watcher 源码研究

状态：D-37 / Q-30 的只读研究输入，含 D-38 补充边界。没有选择生产依赖、安装 daemon、监听目录或访问 Owner 数据。手动上传/粘贴仍是可用回退。

## 结论先行

本地 companion 应被理解为：**只对已授权项目根产生候选的、钉版本的变更事件**。它不是知识同步器，也不能凭文件事件重写 Card、确认主张或跑 Agent。

两个成熟实现提供互补的底层能力，但都不提供 D-37 的项目授权、版本快照、持久 checkpoint、受影响事项匹配或 Owner 审阅：

| 候选 | 适合当作 | 不适合当作 | 研究结论 |
|---|---|---|---|
| Chokidar 5.0.0（MIT） | Node/TypeScript companion 的最小观察信号层 | 授权、持久队列、hash/revision、恢复或项目知识层 | **最小 local-fixture spike 候选**；用薄 adapter 包住。 |
| watchexec CLI v2.5.1 / library 8.2.0（Apache-2.0） | 有 native/poll、过滤、节流、可变 pathset 与错误/通道控制的 Rust companion 参照 | 轻量嵌入式 Node 依赖或产品领域模型 | **较重的独立 companion 候选**；先研究，不建议先接入。 |

两者都只能在后续 T-11/D-13 完整通过、执行器/结果合同明确后再做**本地 fixture-only**隔离 spike。

## D-37 / D-38 的产品边界

1. 只有 `SourceRegistryEntry + AuthorizationReceipt` 都有效的项目根可被加入 watch set；每个项目分别列出、可检查、可 disable/revoke。
2. companion 只将稳定后的文件变化写成 `candidate_source_change`。它不读取项目外路径、不做全盘/账号扫描、不连接远端账户，也不执行外写。
3. 一个变更事件必须携带旧/新 revision 或明确“不可取得”；受影响事项只能是**建议匹配**，并给出 `matchReason`。不相关变化只保留紧凑 trace。
4. Owner 能检查 watch set、事件、匹配理由，并可 disable/revoke。撤销后立即停止新增读/观察；历史 trace 和固定证据快照仍保留。
5. 任何事件、摘要、Agent 结论或匹配都不自动成为已确认知识、关系或已完成工作项。

## 固定源码证据与 D-13 检查

### 候选 A：Chokidar

| D-13 项 | 证据 |
|---|---|
| 固定版本 | `paulmillr/chokidar` tag `5.0.0`（package version 5.0.0）。 |
| 顶层许可证 | `LICENSE`：MIT。 |
| 核心源码/符号 | `src/index.ts`: `watch()`、`FSWatcher`、`ChokidarOptions`、`WatchHelper`、`FSWatcher._emit()`、`_awaitWriteFinish()`、`_isIgnored()`、`unwatch()`、`close()`。 |
| 实际观察行为 | `FSWatcherEventMap` 提供 `add/addDir/change/unlink/unlinkDir/ready/raw/error/all`；`atomic` 将短暂 unlink+add 合并为 change；`awaitWriteFinish` 以 size 稳定性延迟发出 add/change；`_throttle("change", path, 50)` 压制短时间重复 change。 |
| 根/ignore/symlink | `watch(paths, options)` 只接入调用者传入的 paths；`cwd`、`depth`、`ignored` 和 `unwatch()` 可约束监听集合；`WatchHelper` 的 `followSymlinks` 默认 true，决定 stat/lstat。库本身不把 realpath 与产品授权根做安全比较。 |
| 版本/恢复/背压 | 事件可带 `Stats`（`alwaysStat` 可要求），但没有 content hash、持久 cursor/checkpoint、overflow→rescan 协议或 durable queue。EventEmitter 回调无产品级 backpressure/crash recovery。 |
| 直接/传递许可证 | `package.json` 列顶层 MIT、直接 runtime dependency `readdirp ^5.0.0`。本研究未安装或解 lock；`readdirp` 与所有 Node 传递包的固定版本/许可证仍须在 T-11 以 lockfile/SBOM 审核。故**未完成传递许可证 gate，不可称 adopted**。 |
| macOS/runtime | ESM-only，Node `>=20.19.0`；默认 `fs.watch`，可 `usePolling`。作为同栈 helper 运行成本低，但递归 watches 仍会占文件句柄，且 polling 有 CPU 成本。 |
| 可替换/退出 | 将其限制在 `LocalWatchAdapter` 内：停止 watcher、删除 adapter 包和本地 fixture state 即退出；已经写入的产品 change-event/trace 不依赖 Chokidar。 |

### 候选 B：watchexec

| D-13 项 | 证据 |
|---|---|
| 固定版本 | `watchexec/watchexec` tag `v2.5.1`；同 tag `crates/lib/Cargo.toml` 的库 crate 为 `watchexec 8.2.0`。 |
| 顶层许可证 | 根 `LICENSE` 与 library manifest 均为 Apache-2.0。 |
| 核心源码/符号 | `crates/lib/src/sources/fs.rs`: `Watcher::{Native,Poll}`、`worker()`、`process_event()`；`crates/lib/src/config.rs`: `Config.pathset()`、`throttle()`、`on_error()`、`fs_ready()`；`crates/lib/src/watched_path.rs`: `WatchedPath::{recursive,non_recursive}`；`crates/events/src/fs.rs`: `FileType::{File,Dir,Symlink,Other}`；`crates/ignore-files/src/lib.rs`: `IgnoreFile`。 |
| 实际观察行为 | `worker()` 根据 pathset 动态 register/unwatch；`process_event()` 将 notify 的 file event kind、path、file type、process id 与 backend metadata 变为 `Event`。事件 kind 来自 notify 的 `CreateKind/ModifyKind/RemoveKind/RenameMode`。`Config.throttle` 默认 50ms，聚合一个周期中的事件。 |
| 根/ignore/symlink | `WatchedPath` 显式 recursive/non-recursive，pathset 为空会关停 FS source。ignore-files crate 支持多层 `.gitignore`/`.ignore` 语义；**不应**默认采纳其 global ignore，因为 D-37 需要每个 Owner 授权根的可见规则。事件带 FileType::Symlink，但库未提供产品授权 realpath 检查。 |
| 版本/恢复/背压 | `Config` 有 error/event channel size（默认 64/4096），action handler 被要求快速返回以免队列填满；`fs_ready()` 告知 pathset 已应用但失败须看 error handler。没有 D-37 content hash、持久 checkpoint/resume 或 overflow 后的产品 rescan/差异协议。 |
| 直接/传递许可证 | library manifest 直接依赖 `notify`、Tokio、watchexec-events/signals/supervisor 等；根 Cargo.lock 是依赖锁入口。该树的全量 SPDX/NOTICE 尚未完成，且本研究未构建。因此**传递许可证 gate 未过，不可 adopted**。 |
| macOS/runtime | Rust/Tokio + native watcher 或 poll；可作为签名独立 companion，但构建/签名/notarization、Rust dependency supply chain、日志与升级面明显重于 Node helper。 |
| 可替换/退出 | 以单独可停止 local process 和 JSON/event boundary 隔离；移除 binary/launch item 及 fixture adapter 即退出，既有产品 event/trace 保留。 |

## 能力比较：什么由库提供，什么必须留在产品合同

| 需要的能力 | Chokidar | watchexec | D-37 产品必须补上 |
|---|---|---|---|
| 授权根限定 | 调用路径 + ignored；无 grant 验证 | pathset；无 grant 验证 | registry/receipt 的 projectId、授权 root realpath、capability、expiry/revoke 每次加入/续看时检查。 |
| create/modify/rename/delete | add/change/unlink；atomic 可折叠 rename-like 临时写 | notify create/modify/remove/rename kinds | 归一为产品 `create/modify/rename/delete/overflow`，rename 需 old/new locator；不确定时标 unknown。 |
| ignore/目录深度 | ignored/cwd/depth | ignore files/filterer/pathset | 只接受 Owner-visible、根内规则；不得读取全局 ignore 或根外目标。 |
| symlink | follow 可配，默认 true | event 可标 Symlink | 默认不跟随；解析 realpath 后仍须落在授权根内，否则仅记拒绝 trace。 |
| 合并/写稳定 | atomic、awaitWriteFinish、change throttle | throttle 聚合 | 变更合并策略必须写入事件（原始计数/窗口），并在 hash 后才形成候选。 |
| hash/revision | 无 | 无 | 由 adapter 在稳定后对允许文件计算 hash，生成 `previousRevision/newRevision`，不可读则写 failure。 |
| overflow/rescan | 无产品协议 | watcher error/queue pressure，不等于 rescan | `overflow` 触发候选 rescan-request；Owner 不可见前不得假称全量同步完成。 |
| checkpoint/resume/crash | close 释放 listener，无持久 checkpoint | pathset 可热变，无持久 checkpoint | 本地状态只保存授权 root ID、最后成功 scan revision、cursor/event id；重启先验证 grant，再对 root 受控 rescan。 |
| backpressure | 回调/Emitter，无 durable queue | event channel 4096 + error channel 64，handler慢会塞满 | bounded local queue；满时落 `overflow`，停止扩散；不得丢失后假称无变化。 |
| affected-matter | 无 | 无 | 仅以现有项目 evidence/revision locator 找相关 matter，生成候选 match reason；无匹配保持 compact trace。 |

## D-37 事件与 D-38 可见控制：使用 T-20 合同，不另起真相层

### `CandidateSourceChange`（候选事件，非知识）

这是 `RetrievalTrace.objects[]` 的一个本地来源对象处置及其候选事件补充，不是平行 knowledge schema：

| 字段 | 用途 |
|---|---|
| `id`, `projectId`, `sourceId`, `authorizationReceiptId` | 绑定 D-29/T-20 项目来源与有效授权。 |
| `watchSetId`, `rootSelectionId`, `relativePath` | Owner 可检查的 per-matter watch set 与根内相对路径；绝不记录未授权绝对路径。 |
| `kind`, `observedAt`, `coalescedFrom` | `create/modify/rename/delete/overflow/unknown` 与合并原始事件数/窗口。 |
| `previousRevision`, `newRevision`, `snapshotLocator` | hash/version/不可得状态；旧 snapshot 不能被新内容覆盖。 |
| `traceId`, `disposition` | 复用 T-20 trace；初始为 `candidate` 或无关时 `hit`/compact trace。 |
| `status` | `pending_review/disabled/revoked/failed`；不是 knowledge confirmed。 |
| `failure` | 权限、hash、overflow、root-escape、queue-full 等安全原因，不含内容/凭据。 |

`AffectedMatterMatch` 只是一组候选链接：`matterRef`, `matchReason`, `matchedEvidenceRef`, `confidence?`。`matchReason` 必须能说明“同一 pinned locator / 显式 path / 已有 evidence ref”，不得以语义相似自动更改某项工作、主张或关系。无匹配项 = trace-only。

### Owner 可见控制

| Owner 能做 | 必须看到 | 系统不得做 |
|---|---|---|
| inspect | 每个项目的 root、包含/忽略规则、能力、授权有效期、最后事件、候选匹配理由。 | 以“本机 companion 已装”代替具体 watch set。 |
| disable | 立即停止该 watch set 新事件；历史 trace/固定 evidence 可回看。 | 删除旧证据、静默把另一个 root 接管。 |
| revoke | 写 receipt revoke，关闭监听并拒绝重连/重启后的 rescan。 | 等到下次同步才生效。 |
| review | 逐条查看旧/新 revision、候选匹配和依据；决定是否使用为 evidence/发起复查。 | 自动确认知识、覆盖结论、关闭任务或执行 Agent。 |

## 本地 fixture-only adapter/spike 提案（未执行）

前提：由后续执行器/结果合同明确批准，且仅使用仓库内新建临时 fixture root，不读取任何 Owner 目录、`data/knowledge` 或已绑定材料。

1. fixture 写入三个文件，选择一个**synthetic** `SourceRegistryEntry` 与有效只读 receipt；adapter 只接受该 root 的 canonical realpath。
2. 用 Chokidar 的 `watch(root, { ignored, followSymlinks: false, awaitWriteFinish, atomic })` 接收 create/change/delete；对每个稳定事件计算 SHA-256，序列化为 `CandidateSourceChange`，不调用 repository/Agent/外网。
3. 测试 root escape、symlink escape、ignore、atomic rename、delete、queue-full→overflow、disable/revoke、重启后“先 rescan candidate”而非假装连续；断言没有自动 Card/Relation/Action/knowledge confirmation。
4. 仅验证本地 event envelope 与 shutdown；结束时 close watcher、删除 fixture 和 adapter。任何真实监看、菜单栏 daemon、LaunchAgent、notarization、连接器或产品写回均不在本 spike。

该提案不是执行许可，也不证明 Chokidar 被采用。

## 推荐输入与剩余门槛

- 若后续只需在现有 Node/TS 产品旁验证一个授权 root 的事件合同，优先评估 Chokidar 的薄 adapter：依赖和退出面较小，但必须补齐全部 D-37 安全/持久性语义。
- watchexec 更适合将来需要独立、可签名 companion 和受控 channel 的场景；它的 Rust 打包、供应链和运行面不适合作为第一刀。
- 两者都不能直接实现 D-38。生产前仍需：固定 commit（tag 解析到 commit）、直接与传递 license/SBOM 审核、macOS packaging/signing 策略、fixture-only 验证、Owner watch-set UI、D-29 receipt 校验、D-32 revision/证据与 D-34 review fan-out 合同。

## 公开源码定位

- Chokidar 5.0.0：`src/index.ts`、`package.json`、`LICENSE`。
- watchexec v2.5.1：`crates/lib/src/{lib,config,sources/fs,watched_path}.rs`、`crates/events/src/fs.rs`、`crates/ignore-files/src/lib.rs`、`crates/lib/Cargo.toml`、根 `LICENSE` / `Cargo.lock`。

公开源码仅用于本研究。没有 clone、安装、构建或运行任何候选。
