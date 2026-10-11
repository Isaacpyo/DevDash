import { NextResponse } from "next/server";
import { authAvailable } from "@/lib/auth/current-session";
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
      cacheReachable: await store.ping(),
      oauth: config.oauth.provider,
      auth: authAvailable(),
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
