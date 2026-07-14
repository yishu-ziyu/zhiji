import { NextRequest, NextResponse } from "next/server";
import {
  ANYSEARCH_DOMAINS,
  anySearch,
  type AnySearchDomain,
} from "@/shared/anysearch/client";

/**
 * POST /api/knowledge/web-search
 * Body: { query, maxResults?, domain? }
 * Proxies AnySearch MCP so the browser never holds the API key.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      query?: string;
      maxResults?: number;
      domain?: string;
    };
    const query = body.query?.trim() ?? "";
    if (!query) {
      return NextResponse.json({ error: "query 不能为空" }, { status: 400 });
    }

    let domain: AnySearchDomain | undefined;
    if (body.domain && body.domain !== "general") {
      if (!(ANYSEARCH_DOMAINS as readonly string[]).includes(body.domain)) {
        return NextResponse.json(
          { error: `不支持的 domain: ${body.domain}` },
          { status: 400 },
        );
      }
      domain = body.domain as AnySearchDomain;
    } else if (body.domain === "general") {
      domain = "general";
    }

    const result = await anySearch({
      query,
      maxResults: body.maxResults ?? 5,
      domain,
    });

    return NextResponse.json({
      query: result.query,
      domain: result.domain ?? "general",
      hits: result.hits,
      count: result.hits.length,
      elapsedMs: result.elapsedMs,
      authMode: result.authMode,
      provider: "anysearch",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AnySearch 检索失败",
      },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? "";
  if (!query) {
    return NextResponse.json({ error: "缺少 q" }, { status: 400 });
  }
  const domainParam = req.nextUrl.searchParams.get("domain") ?? undefined;
  let domain: AnySearchDomain | undefined;
  if (domainParam && (ANYSEARCH_DOMAINS as readonly string[]).includes(domainParam)) {
    domain = domainParam as AnySearchDomain;
  }
  try {
    const result = await anySearch({
      query,
      domain,
      maxResults: Number(req.nextUrl.searchParams.get("limit") ?? "5"),
    });
    return NextResponse.json({
      query: result.query,
      domain: result.domain ?? "general",
      hits: result.hits,
      count: result.hits.length,
      elapsedMs: result.elapsedMs,
      authMode: result.authMode,
      provider: "anysearch",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AnySearch 检索失败",
      },
      { status: 502 },
    );
  }
}
