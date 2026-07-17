import { NextRequest, NextResponse } from "next/server";
import { verifyAndActivate } from "@/shared/llm/activate";
import {
  getByokStatus,
  rejectClientVerifiedAt,
  toPublicByokStatus,
} from "@/shared/llm/byok";
import { competitionPresets } from "@/shared/llm/presets";
import { isLlmProvider } from "@/shared/llm/types";
import { redactSecrets } from "@/shared/llm/redact";

/**
 * GET: public status + competition presets (no secrets).
 * PUT: verify-and-activate — server probe then atomic save.
 * Client verifiedAt is rejected.
 */
export async function GET() {
  const status = getByokStatus();
  return NextResponse.json({
    ok: true,
    status: toPublicByokStatus(status),
    presets: competitionPresets().map((p) => ({
      provider: p.provider,
      displayName: p.displayName,
      shortName: p.shortName,
      connectionKind: p.connectionKind,
      protocol: p.protocol,
      authMode: p.authMode,
      baseUrl: p.baseUrl,
      logoSrc: p.logoSrc,
      models: p.models,
      competitionPrimary: p.competitionPrimary,
    })),
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const reject = rejectClientVerifiedAt(body);
    if (reject) {
      return NextResponse.json({ error: reject, errorCode: "client_verified_at" }, { status: 400 });
    }

    if (!isLlmProvider(body.provider)) {
      return NextResponse.json({ error: "无效的连接" }, { status: 400 });
    }

    const result = await verifyAndActivate({
      provider: body.provider,
      model: String(body.llmModel ?? body.model ?? ""),
      apiKey:
        body.llmApiKey !== undefined
          ? String(body.llmApiKey)
          : body.apiKey !== undefined
            ? String(body.apiKey)
            : undefined,
      protocol: body.protocol as never,
      authMode: body.authMode as never,
      baseUrl:
        body.llmBaseUrl !== undefined
          ? String(body.llmBaseUrl)
          : body.baseUrl !== undefined
            ? String(body.baseUrl)
            : undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: redactSecrets(result.error, {
            secrets: [String(body.llmApiKey ?? body.apiKey ?? "")].filter(
              Boolean,
            ) as string[],
          }),
          errorCode: result.errorCode,
          diagnostic: result.diagnostic
            ? redactSecrets(result.diagnostic)
            : undefined,
          status: result.status
            ? toPublicByokStatus(result.status)
            : toPublicByokStatus(getByokStatus()),
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: toPublicByokStatus(result.status),
      verifiedAt: result.verifiedAt,
      message: result.message,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: redactSecrets(
          error instanceof Error ? error.message : "保存模型配置失败",
        ),
      },
      { status: 400 },
    );
  }
}
