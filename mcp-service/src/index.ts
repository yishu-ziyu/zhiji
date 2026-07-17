import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const VERSION = "0.1.0";
const MAX_MATERIALS = 12;

const materialSchema = z.object({
  path: z.string().min(1).max(240).describe("调用者主动提交的文件名或相对路径"),
  revision: z.string().min(1).max(160).describe("文件的精确版本、哈希或修订号"),
  content: z.string().min(1).max(6000).describe("需要分析的文本内容"),
});

const evidenceSchema = z.object({
  path: z.string().min(1).max(240),
  revision: z.string().max(160).optional(),
  quote: z.string().max(1200).optional(),
  relation: z.enum(["supports", "contradicts", "limits"]).describe("该证据与 Claim 的关系"),
});

type Material = z.infer<typeof materialSchema>;

function excerpt(content: string, matcher: RegExp): string | null {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hit = lines.find((line) => matcher.test(line));
  if (!hit) return null;
  return hit.length > 220 ? `${hit.slice(0, 217)}...` : hit;
}

function analyzeMaterials(projectName: string, materials: Material[], focus?: string) {
  const completionPattern = /(?:\bdone\b|\bcomplete(?:d)?\b|\bpackaged\b|\btested\b|已完成|已打包|已测试|完成(?:了)?(?:打包|测试)|通过)/i;
  const unresolvedPattern = /(?:\btodo\b|\bpending\b|\bunverified\b|\bunknown\b|\brisk\b|待验收|待确认|未验证|未完成|未知|风险|暂缓)/i;
  const acceptancePattern = /(?:\baccepted\b|已验收|验收通过|owner\s+(?:已)?确认)/i;
  const negatedAcceptancePattern = /(?:\bnot\s+accepted\b|未\s*accepted|尚未\s*accepted|待验收|未验收|尚未验收)/i;

  const completionEvidence = materials.flatMap((material) => {
    const quote = excerpt(material.content, completionPattern);
    return quote ? [{ path: material.path, revision: material.revision, quote }] : [];
  });
  const unresolvedEvidence = materials.flatMap((material) => {
    const quote = excerpt(material.content, unresolvedPattern);
    return quote ? [{ path: material.path, revision: material.revision, quote }] : [];
  });
  const acceptanceEvidence = materials.flatMap((material) => {
    const quote = excerpt(material.content, acceptancePattern);
    return quote && !negatedAcceptancePattern.test(quote)
      ? [{ path: material.path, revision: material.revision, quote }]
      : [];
  });

  const hasSignals = completionEvidence.length + unresolvedEvidence.length > 0;
  const mixed = completionEvidence.length > 0 && unresolvedEvidence.length > 0;
  const grounded = hasSignals ? "grounded" : "insufficient";

  const currentJudgment = mixed
    ? `「${projectName}」同时存在完成信号和未决信号；现有材料足以证明已有进展，但不足以把工程完成直接等同于最终验收。`
    : completionEvidence.length > 0
      ? `「${projectName}」的已提交材料包含完成信号；是否可称为最终完成，仍取决于验收证据。`
      : unresolvedEvidence.length > 0
        ? `「${projectName}」仍存在未决或待验收事项，当前不应声称已最终完成。`
        : `已读取「${projectName}」的 ${materials.length} 份显式提交材料，但未找到足够的完成或未决信号，暂不下结论。`;

  const unknowns: string[] = [];
  if (acceptanceEvidence.length === 0) unknowns.push("未找到明确的 Owner 最终验收证据。");
  if (unresolvedEvidence.length === 0) unknowns.push("未找到明确的待办、风险或未知记录。");
  if (!focus?.trim()) unknowns.push("未提供本次希望优先裁决的关注点。");

  return {
    status: grounded,
    currentJudgment,
    whyImportant: mixed
      ? "完成与待验收信号并存，最容易造成「已经完成」的虚假确定性。"
      : "下一步决定应以可核对的当前材料为准，不用无依据的完整叙事补齐未知。",
    evidence: {
      completion: completionEvidence.slice(0, 5),
      unresolved: unresolvedEvidence.slice(0, 5),
      acceptance: acceptanceEvidence.slice(0, 3),
    },
    unknowns,
    decisionPrompt: mixed
      ? "是否暂停新功能，先完成尚缺的 Owner 端到端验收？"
      : "现在最影响下一步的未知是什么，由谁提供可核对的证据？",
    scope: {
      materialCount: materials.length,
      focus: focus?.trim() || null,
      readBoundary: "caller_supplied_content_only",
    },
  };
}

function createServer() {
  const server = new McpServer({ name: "zhiji-project-intelligence", version: VERSION });

  server.tool(
    "analyze_project_state",
    "分析调用者主动提交的项目文本，返回当前判断、精确版本依据、未知和一个待决定问题。不读取本地文件，不存储输入，不修改项目。",
    {
      projectName: z.string().min(1).max(120),
      materials: z.array(materialSchema).min(1).max(MAX_MATERIALS),
      focus: z.string().max(500).optional(),
    },
    async ({ projectName, materials, focus }) => ({
      content: [{ type: "text", text: JSON.stringify(analyzeMaterials(projectName, materials, focus), null, 2) }],
      structuredContent: analyzeMaterials(projectName, materials, focus),
    }),
  );

  server.tool(
    "verify_claim_evidence",
    "检查一条项目 Claim 是否有带精确 Revision 的支持、冲突或限制证据。本工具检查证据完整性和声明的关系，不把调用者的声明自动确认为项目事实。",
    {
      claim: z.string().min(1).max(1200),
      evidence: z.array(evidenceSchema).min(1).max(20),
    },
    async ({ claim, evidence }) => {
      const valid = evidence.filter((item) => item.revision?.trim() && item.quote?.trim());
      const missing = evidence
        .filter((item) => !item.revision?.trim() || !item.quote?.trim())
        .map((item) => ({ path: item.path, missingRevision: !item.revision?.trim(), missingQuote: !item.quote?.trim() }));
      const supports = valid.filter((item) => item.relation === "supports");
      const contradicts = valid.filter((item) => item.relation === "contradicts");
      const limits = valid.filter((item) => item.relation === "limits");
      const status = contradicts.length > 0 ? "conflicting" : supports.length > 0 ? "grounded" : "insufficient";
      const result = {
        claim,
        status,
        supports,
        contradicts,
        limits,
        missing,
        confirmedFact: false,
        note: "这是候选判断的证据检查结果；只有 Owner Resolution 才能使其成为已确认项目事实。",
      };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
    },
  );

  return server;
}

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return Response.json({
        name: "知几 · 项目情报 MCP",
        team: "不俟终日",
        version: VERSION,
        transport: "Streamable HTTP",
        endpoint: "/mcp",
        tools: ["analyze_project_state", "verify_claim_evidence"],
        privacy: "只处理调用者显式提交的文本；不读取本地文件，不存储输入，无写入工具。",
      });
    }
    if (url.pathname !== "/mcp") return new Response("Not Found", { status: 404 });
    return createMcpHandler(createServer(), {
      route: "/mcp",
      enableJsonResponse: true,
      corsOptions: {
        origin: "*",
        methods: "GET,POST,DELETE,OPTIONS",
        headers: "Content-Type,Accept,Mcp-Session-Id,MCP-Protocol-Version,Last-Event-ID",
        exposeHeaders: "Mcp-Session-Id,MCP-Protocol-Version",
      },
    })(request, env, ctx);
  },
} satisfies ExportedHandler;
