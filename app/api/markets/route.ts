import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getLiveMarkets } from "@/lib/live-markets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const markets = await getLiveMarkets(prisma);

    const active = markets.filter((market) => market.status === "active");
    const settled = markets.filter((market) => market.status === "settled");

    let result = markets;
    if (status === "active") {
      result = active;
    } else if (status === "settled") {
      result = settled;
    }

    return NextResponse.json({
      markets: result,
      meta: {
        total: result.length,
        active: active.length,
        settled: settled.length,
      },
    });
  } catch (error) {
    console.error("Markets error:", error);
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 });
  }
}
