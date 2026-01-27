import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMarketsFromCache } from "@/lib/model-cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Get markets from database cache
    const { active, settled } = await getMarketsFromCache(prisma);

    // Get trade stats
    const marketStats = await prisma.market.findMany({
      select: {
        marketId: true,
        totalVolume: true,
        settledAt: true,
        createdAtTime: true,
        _count: { select: { trades: true } },
      },
    });

    const statsMap = new Map(
      marketStats.map(m => [m.marketId.toString(), {
        totalTrades: m._count.trades,
        totalVolume: m.totalVolume || "0",
        settledAt: m.settledAt,
        createdAt: m.createdAtTime,
      }])
    );

    // Build result
    let result: any[] = [];

    for (const m of active) {
      const stats = statsMap.get(m.marketId);
      result.push({
        ...m,
        totalTrades: stats?.totalTrades || 0,
        totalVolume: formatVolume(stats?.totalVolume || "0"),
        createdAt: stats?.createdAt,
      });
    }

    for (const m of settled) {
      const stats = statsMap.get(m.marketId);
      result.push({
        ...m,
        totalTrades: stats?.totalTrades || 0,
        totalVolume: formatVolume(stats?.totalVolume || "0"),
        settledAt: stats?.settledAt,
        createdAt: stats?.createdAt,
      });
    }

    // Filter by status
    if (status === "active") {
      result = result.filter(m => m.status === "active");
    } else if (status === "settled") {
      result = result.filter(m => m.status === "settled");
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

function formatVolume(vol: string): string {
  try {
    const num = Number(BigInt(vol)) / 1e18;
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
    return num.toFixed(2);
  } catch {
    return "0.00";
  }
}
