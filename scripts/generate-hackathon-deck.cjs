const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "不俟终日";
pptx.subject = "知几黑客松五页路演";
pptx.title = "知几｜用最少注意力，完成足够正确的下一步决定";
pptx.company = "不俟终日";
pptx.lang = "zh-CN";
pptx.theme = {
  headFontFace: "Songti SC",
  bodyFontFace: "Songti SC",
  lang: "zh-CN",
};
pptx.defineLayout({ name: "ZH_WIDE", width: 13.333, height: 7.5 });
pptx.layout = "ZH_WIDE";
pptx.margin = 0;

const C = {
  ink: "171918",
  ink2: "262826",
  ivory: "F7F3EA",
  paper: "FCFAF5",
  gold: "C69A45",
  gold2: "E7D2A7",
  text: "171918",
  muted: "77766F",
  line: "DED9CE",
  white: "FFFFFF",
  blue: "2F73FF",
  green: "5B8C64",
};

const ROOT = "/Users/mahaoxuan/Desktop/黑客松/zhiji";
const ASSETS = "/Users/mahaoxuan/Desktop/知几路演素材";
const cover = "/Users/mahaoxuan/.codex/generated_images/019f6c32-c371-7760-81ba-d241867fe347/exec-e39195c2-690d-4d32-8102-44d53f422eeb.png";
const logo = path.join(ROOT, "public/brand/zhiji-mark.png");
const firstLaunch = path.join(ASSETS, "01-知几首次启动.png");
const workbench = path.join(ASSETS, "02-知几项目情报工作台.png");
const out = "/Users/mahaoxuan/Desktop/知几-黑客松五页路演-衬线版.pptx";

for (const p of [cover, logo, firstLaunch, workbench]) {
  if (!fs.existsSync(p)) throw new Error(`Missing asset: ${p}`);
}

function addText(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontFace: opts.fontFace || "Songti SC",
    fontSize: opts.fontSize || 18,
    color: opts.color || C.text,
    bold: opts.bold || false,
    breakLine: false,
    margin: 0,
    valign: opts.valign || "mid",
    align: opts.align || "left",
    fit: "shrink",
    paraSpaceAfterPt: opts.paraSpaceAfterPt || 0,
    charSpacing: opts.charSpacing ?? -0.2,
    isTextBox: true,
    ...opts,
  });
}

function addLine(slide, x, y, w, h, color = C.line, width = 1, transparency = 0) {
  slide.addShape(pptx.ShapeType.line, {
    x, y, w, h,
    line: { color, width, transparency, beginArrowType: "none", endArrowType: "none" },
  });
}

function addPill(slide, text, x, y, w, fill = C.ink, color = C.ivory) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.34,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: fill, transparency: 100 },
  });
  addText(slide, text, x, y + 0.01, w, 0.3, {
    fontFace: "Helvetica Neue", fontSize: 10, color, bold: true, align: "center", charSpacing: 0.5,
  });
}

function addSlideNo(slide, n, dark = false) {
  addText(slide, String(n).padStart(2, "0"), 12.56, 7.08, 0.38, 0.2, {
    fontSize: 9, color: dark ? C.gold2 : C.muted, align: "right", charSpacing: 1.2,
  });
}

function addImageCrop(slide, imagePath, x, y, w, h, imageW, imageH) {
  const target = w / h;
  const source = imageW / imageH;
  let sx = 0, sy = 0, sw = imageW, sh = imageH;
  if (source > target) {
    sw = imageH * target;
    sx = (imageW - sw) / 2;
  } else {
    sh = imageW / target;
    sy = (imageH - sh) / 2;
  }
  slide.addImage({ path: imagePath, x, y, w, h, sizing: "crop", crop: { x: sx, y: sy, w: sw, h: sh } });
}

function addWindowFrame(slide, imagePath, x, y, w, h, imageW, imageH, dark = false) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: x - 0.06, y: y - 0.34, w: w + 0.12, h: h + 0.4,
    rectRadius: 0.12,
    fill: { color: dark ? "0D0E0E" : C.white },
    line: { color: dark ? "363837" : "DDD9D0", width: 0.6 },
    shadow: { type: "outer", color: "000000", opacity: 0.2, blur: 2, angle: 45, distance: 2 },
  });
  [0, 1, 2].forEach((i) => slide.addShape(pptx.ShapeType.ellipse, {
    x: x + 0.12 + i * 0.17, y: y - 0.23, w: 0.08, h: 0.08,
    fill: { color: ["FF5F57", "FEBC2E", "28C840"][i] },
    line: { transparency: 100 },
  }));
  addImageCrop(slide, imagePath, x, y, w, h, imageW, imageH);
}

// Slide 1 — brand + problem
{
  const s = pptx.addSlide();
  addImageCrop(s, cover, 0, 0, 13.333, 7.5, 1672, 941);
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 7.2, h: 7.5, fill: { color: C.ink, transparency: 9 }, line: { transparency: 100 } });
  addPill(s, "不俟终日  ·  HACKATHON 2026", 0.72, 0.62, 2.5, "2A2C2B", C.gold2);
  addText(s, "人的注意力，\n跟不上项目的变化", 0.72, 1.56, 5.65, 2.08, {
    fontSize: 31.5, bold: true, color: C.ivory, breakLine: true, valign: "top", lineSpacingMultiple: 0.9, charSpacing: -1,
  });
  addText(s, "知几", 0.72, 4.18, 1.5, 0.55, { fontSize: 26, bold: true, color: C.gold2, charSpacing: 4 });
  addText(s, "一个运行在本地、以证据为基础的项目情报 Agent", 0.72, 4.83, 5.25, 0.38, {
    fontSize: 15.5, color: C.ivory,
  });
  addText(s, "它不是帮你看见更多，\n而是让你只看见此刻真正需要看见的东西。", 0.72, 5.48, 4.65, 0.82, {
    fontSize: 13.5, color: "D9D4C9", breakLine: true, valign: "top", lineSpacingMultiple: 0.92,
  });
  addLine(s, 0.72, 6.73, 1.1, 0, C.gold, 2);
  addText(s, "作品·知几   队伍·不俟终日", 1.98, 6.62, 3.4, 0.24, { fontSize: 9.5, color: "AAA69C", charSpacing: 0.6 });
  s.addNotes("0:00–0:45\n我们每天都在同时推进很多复杂项目。最痛苦的不是资料找不到，而是每次重新回来，都要重新理解发生了什么、哪些是真的、现在该做什么。我们做的是知几：不帮你看见更多，而是用最少注意力恢复足够正确的判断。");
}

// Slide 2 — problem + agent contract
{
  const s = pptx.addSlide();
  s.background = { color: C.paper };
  addPill(s, "WHY", 0.62, 0.47, 0.66, C.ink, C.ivory);
  addText(s, "重新回来，\n不该等于重新读一遍", 0.62, 1.02, 4.05, 1.25, {
    fontSize: 26.5, bold: true, color: C.ink, breakLine: true, valign: "top", charSpacing: -0.9,
  });
  const qs = ["发生了什么？", "哪些是真的？", "现在最重要的是什么？", "我接下来需要决定什么？"];
  qs.forEach((q, i) => {
    const y = 2.62 + i * 0.72;
    addText(s, `0${i + 1}`, 0.62, y + 0.03, 0.36, 0.28, { fontSize: 10, color: C.gold, bold: true });
    addText(s, q, 1.12, y, 3.35, 0.36, { fontSize: 16, color: C.ink, bold: i === 3 });
    addLine(s, 1.12, y + 0.5, 3.1, 0, C.line, 0.7);
  });
  addText(s, "知几的工作合同", 5.18, 0.98, 2.6, 0.35, { fontSize: 12, color: C.gold, bold: true, charSpacing: 1.2 });
  const flow = [
    ["观察变化", "只在明确授权边界内"],
    ["过滤噪声", "不相关文件不挤占注意力"],
    ["形成候选判断", "推断不伪装成事实"],
    ["绑定证据与未知", "Claim ↔ 精确 Revision"],
    ["Owner 裁决", "接受 / 修改 / 拒绝 / 暂缓"],
    ["继续观察", "保留决定，等待新变化"],
  ];
  flow.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 5.18 + col * 2.48;
    const y = 1.56 + row * 1.38;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: 2.15, h: 1.02, rectRadius: 0.08,
      fill: { color: row === 0 ? "F0EBE0" : C.white },
      line: { color: i === 4 ? C.gold : C.line, width: i === 4 ? 1.3 : 0.7 },
    });
    addText(s, `0${i + 1}`, x + 0.16, y + 0.12, 0.3, 0.2, { fontSize: 9, color: C.gold, bold: true });
    addText(s, item[0], x + 0.16, y + 0.34, 1.82, 0.25, { fontSize: 12.5, color: C.ink, bold: true });
    addText(s, item[1], x + 0.16, y + 0.65, 1.82, 0.25, { fontSize: 8.5, color: C.muted });
    if (i < 5 && i !== 2) addLine(s, x + 2.17, y + 0.51, 0.27, 0, C.gold, 1.2);
  });
  addWindowFrame(s, firstLaunch, 5.18, 4.64, 7.42, 1.72, 3420, 2138);
  addPill(s, "真实首次启动页", 10.72, 6.48, 1.85, C.ink, C.ivory);
  addSlideNo(s, 2);
  s.addNotes("0:45–1:35\n现有工具会保存文件、记录任务、搜索内容，但不会持续维护项目当前的真实状态。知几不是一个聪明聊天框，它有明确的工作合同：观察、过滤、判断、找证据、请 Owner 裁决，然后继续观察。");
}

// Slide 3 — demo golden path
{
  const s = pptx.addSlide();
  s.background = { color: C.ink };
  addPill(s, "DEMO  /  05:00", 0.62, 0.46, 1.36, "2A2C2B", C.gold2);
  addText(s, "重新进入一个项目，\n五分钟恢复判断", 0.62, 1.0, 4.0, 1.26, {
    fontSize: 27.5, bold: true, color: C.ivory, breakLine: true, valign: "top", charSpacing: -0.9,
  });
  const steps = [
    ["授权", "选择真实项目夹"],
    ["真读", "map / search / read"],
    ["恢复", "材料关系 + 当前态势"],
    ["追问", "业务逻辑 / 数据集验证"],
    ["去噪", "识别杭州旅行 Markdown"],
    ["确认", "裁决后刷新仍恢复"],
  ];
  steps.forEach((item, i) => {
    const y = 2.56 + i * 0.61;
    s.addShape(pptx.ShapeType.ellipse, { x: 0.64, y: y + 0.03, w: 0.25, h: 0.25, fill: { color: i < 3 ? C.gold : "3A3C3B" }, line: { transparency: 100 } });
    addText(s, String(i + 1), 0.64, y + 0.03, 0.25, 0.25, { fontSize: 8, color: i < 3 ? C.ink : C.gold2, bold: true, align: "center" });
    addText(s, item[0], 1.05, y, 0.72, 0.31, { fontSize: 12, color: C.ivory, bold: true });
    addText(s, item[1], 1.82, y, 2.65, 0.31, { fontSize: 10.5, color: "AAA9A3" });
  });
  addWindowFrame(s, workbench, 5.05, 1.16, 7.62, 5.0, 2560, 1680, true);
  s.addShape(pptx.ShapeType.roundRect, { x: 8.12, y: 5.5, w: 3.92, h: 0.78, rectRadius: 0.09, fill: { color: "0C0D0D", transparency: 8 }, line: { color: C.gold, width: 1.1 } });
  addText(s, "现在发生了什么？   为什么重要？\n现在需要你决定什么？", 8.32, 5.6, 3.52, 0.5, {
    fontSize: 11.5, color: C.ivory, bold: true, breakLine: true, align: "center",
  });
  addText(s, "真实产品界面  ·  知几 项目情报 Agent", 5.06, 6.38, 4.3, 0.24, { fontSize: 9, color: "979790", charSpacing: 0.6 });
  addSlideNo(s, 3, true);
  s.addNotes("1:35–3:35\n现场用上一次黑客松‘红鲱鱼与枪’演示。首先明确授权真实文件夹，Agent 会真实调用 map/search/read，恢复文件关系与项目当前判断。我可以追问整个业务流程或数据集是否测验过，答案不仅是文字，还会指回画布与具体证据。接着放入一份与项目无关的杭州旅行 Markdown，再次分析，Agent 应该识别它是噪声，但不擅自移动。最后由 Owner 确认，刷新后结果仍在。");
}

// Slide 4 — trust state machine
{
  const s = pptx.addSlide();
  s.background = { color: C.paper };
  addPill(s, "TRUST", 0.62, 0.47, 0.78, C.ink, C.ivory);
  addText(s, "可信不是一句承诺，\n而是产品状态机", 0.62, 1.0, 5.3, 1.2, {
    fontSize: 28, bold: true, color: C.ink, breakLine: true, valign: "top", charSpacing: -0.9,
  });
  addText(s, "普通 Copilot 给你一个答案；知几维护一份可持续、可裁决的项目判断。", 0.62, 2.22, 8.1, 0.32, { fontSize: 13.5, color: C.muted });
  const cards = [
    ["授权先于读取", "只读用户明确选择的文件夹；本地读取不等于永不调用模型服务。", "01"],
    ["Claim ↔ Revision", "每条重要判断都能回到具体文件的精确版本。", "02"],
    ["Candidate ≠ 事实", "建议不会自动变成正式任务；Owner 接受、修改、拒绝或暂缓。", "03"],
    ["失败即失败", "模型或工具失败时，不产生候选判断，不用旧结果假装读懂。", "04"],
  ];
  cards.forEach((c, i) => {
    const x = 0.62 + (i % 2) * 6.1;
    const y = 2.96 + Math.floor(i / 2) * 1.55;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y, w: 5.72, h: 1.25, rectRadius: 0.09,
      fill: { color: i === 1 ? "F1E9D8" : C.white },
      line: { color: i === 1 ? C.gold : C.line, width: i === 1 ? 1.1 : 0.7 },
    });
    addText(s, c[2], x + 0.18, y + 0.15, 0.42, 0.22, { fontSize: 9, color: C.gold, bold: true });
    addText(s, c[0], x + 0.72, y + 0.12, 2.6, 0.31, { fontSize: 15, color: C.ink, bold: true });
    addText(s, c[1], x + 0.72, y + 0.54, 4.66, 0.48, { fontSize: 10.5, color: C.muted, valign: "top", breakLine: true });
  });
  addLine(s, 0.62, 6.25, 12.05, 0, C.line, 0.8);
  addText(s, "本地客户端", 0.62, 6.46, 1.2, 0.25, { fontSize: 10.5, color: C.gold, bold: true });
  addText(s, "Electron  ·  loopback Next.js  ·  React Flow  ·  本地持久化  ·  多模型 BYOK", 1.82, 6.43, 6.85, 0.3, { fontSize: 11.5, color: C.ink, bold: true });
  addText(s, "GPT-5.6 Sol / MiniMax / StepFun  ·  AI Coding / 开源组件完整披露", 8.55, 6.43, 4.15, 0.3, { fontSize: 8.3, color: C.muted, align: "right" });
  addSlideNo(s, 4);
  s.addNotes("3:35–4:25\n知几的可信不是一句‘我不会幻觉’。它是明确的状态机：授权在任何读取之前；重要 Claim 与精确 Revision 绑定；Candidate 不是事实，正式判断由 Owner 终裁；模型失败时就诚实失败，不假装成功。这也是我们做成本地客户端的原因：它需要持续感知项目变化，同时保留授权和证据边界。");
}

// Slide 5 — value + business
{
  const s = pptx.addSlide();
  s.background = { color: C.ivory };
  addPill(s, "VALUE", 0.62, 0.47, 0.77, C.ink, C.ivory);
  addText(s, "少看  ·  少错  ·  少拖", 0.62, 1.22, 7.1, 0.72, { fontSize: 31, bold: true, color: C.ink, charSpacing: -0.5 });
  addText(s, "不是让 AI 替人掌控项目，而是用最少的注意力，帮助人形成足够正确的判断。", 0.62, 2.05, 8.6, 0.38, { fontSize: 14, color: C.muted });
  const cols = [
    ["个人", "多项目工作者", "持续保留项目判断\n个人订阅"],
    ["团队", "小型研发与创作团队", "共享事实边界与决策记录\n按成员 / 项目"],
    ["交付", "咨询、客户项目与研发协作", "生成可核验的项目简报\n企业连接与服务"],
  ];
  cols.forEach((c, i) => {
    const x = 0.62 + i * 3.75;
    s.addShape(pptx.ShapeType.roundRect, {
      x, y: 3.05, w: 3.38, h: 2.2, rectRadius: 0.12,
      fill: { color: i === 1 ? C.ink : C.white },
      line: { color: i === 1 ? C.ink : C.line, width: 0.7 },
      shadow: i === 1 ? { type: "outer", color: "000000", opacity: 0.14, blur: 2, angle: 45, distance: 1.5 } : undefined,
    });
    addText(s, `0${i + 1}`, x + 0.2, 3.25, 0.38, 0.22, { fontSize: 9, color: C.gold, bold: true });
    addText(s, c[0], x + 0.2, 3.6, 1.1, 0.4, { fontSize: 21, color: i === 1 ? C.ivory : C.ink, bold: true });
    addText(s, c[1], x + 0.2, 4.1, 2.94, 0.3, { fontSize: 10, color: i === 1 ? "BDB9AF" : C.muted });
    addText(s, c[2], x + 0.2, 4.5, 2.94, 0.54, { fontSize: 11, color: i === 1 ? C.gold2 : C.ink, bold: true, breakLine: true, valign: "top" });
  });
  addLine(s, 0.62, 5.86, 7.78, 0, C.gold, 1.4);
  addText(s, "知几", 0.62, 6.12, 1.1, 0.42, { fontSize: 23, bold: true, color: C.ink, charSpacing: 4 });
  addText(s, "用最少的注意力，完成足够正确的下一步决定。", 1.86, 6.18, 5.75, 0.3, { fontSize: 13.5, color: C.ink, bold: true });
  s.addImage({ path: logo, x: 11.22, y: 5.52, w: 1.32, h: 1.32, transparency: 0 });
  addText(s, "队伍·不俟终日", 10.15, 6.88, 2.35, 0.22, { fontSize: 9, color: C.muted, align: "right", charSpacing: 0.8 });
  addSlideNo(s, 5);
  s.addNotes("4:25–5:00\n我们把价值总结为三个词：少看、少错、少拖。它先服务同时推进多个复杂项目的个人，再扩展到小团队和客户交付。后续可以连接代码仓、文档、会议和任务系统，但不改变授权与证据边界。我们希望做的不是让 AI 替人掌控项目，而是帮助人形成足够正确的判断，并完成下一步决定。");
}

pptx.writeFile({ fileName: out, compression: true });
console.log(out);
