import { NextResponse } from "next/server";
import { getLibraryMapData } from "@/shared/knowledge/repository";

export async function GET() {
  const data = getLibraryMapData();
  return NextResponse.json(data);
}
