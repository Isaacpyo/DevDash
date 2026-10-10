import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";

export const dynamic = "force-dynamic";

/** Liveness plus the active configuration (never secrets). */
export async function GET() {
  const { config, store, reportService } = getServices();
  return NextResponse.json(
    {
      status: "ok",
      dataProvider: reportService.providerKind,
      cache: store.name,
      oauth: config.oauth.provider,
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
