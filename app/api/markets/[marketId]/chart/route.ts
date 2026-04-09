import { NextRequest, NextResponse } from "next/server";
import { isNumericMarketId } from "@/lib/live-markets";
import { normalizeMarketId } from "@/lib/markets-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cache chart data for 30 seconds
let chartCache: Record<string, { data: any; time: number }> = {};
const CACHE_DURATION = 30 * 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const { marketId: rawMarketId } = await params;
  const marketId = normalizeMarketId(rawMarketId);
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get("timeframe") || "auto";

  if (!isNumericMarketId(marketId)) {
    return NextResponse.json({ error: "Invalid market ID" }, { status: 400 });
  }

  const cacheKey = `${marketId}-${timeframe}`;

  // Return cached data if fresh
  if (chartCache[cacheKey] && Date.now() - chartCache[cacheKey].time < CACHE_DURATION) {
    return NextResponse.json(chartCache[cacheKey].data);
  }

  try {
    const res = await fetch(
      `https://delphi.gensyn.ai/api/markets/${marketId}/chart?timeframe=${timeframe}`,
      {
        headers: { "Accept": "application/json" },
        next: { revalidate: 30 },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Delphi API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Cache it
    chartCache[cacheKey] = { data, time: Date.now() };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Chart proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}
