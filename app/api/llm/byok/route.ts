import { NextRequest, NextResponse } from "next/server";
import {
  getByokStatus,
  saveByokSecrets,
  type ByokSecretsInput,
} from "@/shared/llm/byok";

/**
 * BYOK status + save for the in-app model settings panel.
 * GET never returns secret values — only configured flags and non-secret fields.
 */
export async function GET() {
  const status = getByokStatus();
  return NextResponse.json({
    ok: true,
    status: {
      configured: status.configured,
      hasBaseUrl: status.hasBaseUrl,
      hasApiKey: status.hasApiKey,
      hasModel: status.hasModel,
      baseUrl: status.baseUrl,
      model: status.model,
      // Do not expose full path with username if avoidable — still useful for desktop support
      envFileHint: status.envFilePath.includes("Application Support")
        ? "~/Library/Application Support/FC-OPC iBot/.env.local"
        : pathBasenameHint(status.envFilePath),
    },
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ByokSecretsInput>;
    const input: ByokSecretsInput = {
      llmBaseUrl: String(body.llmBaseUrl ?? ""),
      llmApiKey: String(body.llmApiKey ?? ""),
      llmModel: String(body.llmModel ?? ""),
      anysearchApiKey:
        body.anysearchApiKey === undefined
          ? undefined
          : String(body.anysearchApiKey),
    };
    const status = saveByokSecrets(input);
    return NextResponse.json({
      ok: true,
      status: {
        configured: status.configured,
        hasBaseUrl: status.hasBaseUrl,
        hasApiKey: status.hasApiKey,
        hasModel: status.hasModel,
        baseUrl: status.baseUrl,
        model: status.model,
        envFileHint: status.envFilePath.includes("Application Support")
          ? "~/Library/Application Support/FC-OPC iBot/.env.local"
          : pathBasenameHint(status.envFilePath),
      },
      message: "已保存。模型密钥仅在本机，即时生效。",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "保存模型配置失败",
      },
      { status: 400 },
    );
  }
}

function pathBasenameHint(p: string): string {
  // Avoid leaking full home path in JSON; show trailing two segments.
  const parts = p.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 2) return p;
  return `…/${parts.slice(-2).join("/")}`;
}
