/**
 * AnySearch client (MCP tools/call over HTTPS).
 * Docs/skill: https://github.com/anysearch-ai/anysearch-skill
 * Endpoint: https://api.anysearch.com/mcp
 *
 * API key optional: anonymous works with lower quota.
 * Set ANYSEARCH_API_KEY in .env.local for higher limits.
 */

export const ANYSEARCH_MCP_URL = "https://api.anysearch.com/mcp";
export const ANYSEARCH_CLIENT_HEADER = "app/fc-opc-ibot/0.1.0";

export const ANYSEARCH_DOMAINS = [
  "general",
  "resource",
  "social_media",
  "finance",
  "academic",
  "legal",
  "health",
  "business",
  "security",
  "ip",
  "code",
  "energy",
  "environment",
  "agriculture",
  "travel",
  "film",
  "gaming",
] as const;

export type AnySearchDomain = (typeof ANYSEARCH_DOMAINS)[number];

export type AnySearchHit = {
  rank: number;
  title: string;
  url: string;
  snippet: string;
};

export type AnySearchResult = {
  query: string;
  domain?: AnySearchDomain;
  hits: AnySearchHit[];
  rawText: string;
  elapsedMs?: number;
  authMode: "api_key" | "anonymous";
};

export type AnySearchOptions = {
  query: string;
  maxResults?: number;
  domain?: AnySearchDomain;
  subDomain?: string;
  apiKey?: string;
  signal?: AbortSignal;
};

function getApiKey(explicit?: string): string | undefined {
  const key =
    explicit?.trim() ||
    process.env.ANYSEARCH_API_KEY?.trim() ||
    process.env.ANY_SEARCH_API_KEY?.trim();
  return key || undefined;
}

type McpTextResponse = {
  jsonrpc?: string;
  id?: number;
  result?: {
    content?: Array<{ type?: string; text?: string }>;
  };
  error?: { message?: string; code?: number };
};

/** Parse markdown-ish search dump from AnySearch MCP text content. */
export function parseAnySearchMarkdown(text: string): {
  hits: AnySearchHit[];
  elapsedMs?: number;
} {
  const elapsedMatch = text.match(
    /##\s*Search Results\s*\(\s*\d+\s*results?,\s*(\d+)\s*ms\s*\)/i,
  );
  const elapsedMs = elapsedMatch ? Number(elapsedMatch[1]) : undefined;

  const hits: AnySearchHit[] = [];
  const blocks = text.split(/\n(?=###\s+\d+\.\s+)/);

  for (const block of blocks) {
    const header = block.match(/^###\s+(\d+)\.\s+(.+)$/m);
    if (!header) continue;
    const rank = Number(header[1]);
    const title = header[2].trim();
    const urlMatch = block.match(/\*\*URL\*\*\s*:\s*(\S+)/i);
    const url = urlMatch?.[1]?.replace(/[)>.,]+$/, "") ?? "";
    const afterUrl = urlMatch
      ? block.slice(block.indexOf(urlMatch[0]) + urlMatch[0].length)
      : block.replace(header[0], "");
    const snippet = afterUrl
      .replace(/^\s*[-*]\s*/, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);

    if (!title && !url) continue;
    hits.push({ rank, title, url, snippet });
  }

  return { hits, elapsedMs };
}

async function callMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  apiKey?: string,
  signal?: AbortSignal,
): Promise<string> {
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Anysearch-Client": ANYSEARCH_CLIENT_HEADER,
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(ANYSEARCH_MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  const text = await res.text();
  let json: McpTextResponse;
  try {
    json = JSON.parse(text) as McpTextResponse;
  } catch {
    throw new Error(`AnySearch 响应不是 JSON: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(
      `AnySearch HTTP ${res.status}: ${json.error?.message ?? text.slice(0, 200)}`,
    );
  }
  if (json.error?.message) {
    throw new Error(json.error.message);
  }

  const content = json.result?.content;
  if (Array.isArray(content)) {
    const textItem = content.find((c) => c.type === "text" && c.text);
    if (textItem?.text) return textItem.text;
  }
  throw new Error("AnySearch 未返回 text 内容");
}

export async function anySearch(
  options: AnySearchOptions,
): Promise<AnySearchResult> {
  const query = options.query?.trim();
  if (!query) throw new Error("query 不能为空");

  const maxResults = Math.min(Math.max(options.maxResults ?? 5, 1), 10);
  const apiKey = getApiKey(options.apiKey);
  const args: Record<string, unknown> = {
    query,
    max_results: maxResults,
  };
  if (options.domain) {
    args.domain = options.domain;
    if (options.subDomain) args.sub_domain = options.subDomain;
  }

  const rawText = await callMcpTool(
    "search",
    args,
    apiKey,
    options.signal,
  );
  const { hits, elapsedMs } = parseAnySearchMarkdown(rawText);

  return {
    query,
    domain: options.domain,
    hits,
    rawText,
    elapsedMs,
    authMode: apiKey ? "api_key" : "anonymous",
  };
}

/** Format a web hit into a knowledge card body (source-backed). */
export function formatWebHitAsCardContent(hit: AnySearchHit): string {
  const parts = [
    hit.snippet || hit.title,
    hit.url ? `来源 URL: ${hit.url}` : "",
    "抓取通道: AnySearch",
  ].filter(Boolean);
  return parts.join("\n");
}
