import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      totalTrades,
      totalMarkets,
      activeMarkets,
      settledMarkets,
      indexerState,
      uniqueTraders,
    ] = await Promise.all([
      prisma.trade.count(),
      prisma.market.count(),
      prisma.market.count({ where: { status: 0 } }),
      prisma.market.count({ where: { status: 2 } }),
      prisma.indexerState.findUnique({ where: { id: "delphi" } }),
      prisma.traderStats.count(),
    ]);

    // 24h stats
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTrades = await prisma.trade.findMany({
      where: { blockTime: { gte: oneDayAgo } },
      select: { tokensDelta: true, isBuy: true },
    });

    let volume24h = 0n;
    let buys24h = 0;
    let sells24h = 0;

    for (const t of recentTrades) {
      volume24h += BigInt(t.tokensDelta);
      if (t.isBuy) buys24h++;
      else sells24h++;
    }

    // Total volume across all trades
    const allTrades = await prisma.trade.findMany({
      select: { tokensDelta: true },
    });
    let totalVolume = 0n;
    for (const t of allTrades) {
      totalVolume += BigInt(t.tokensDelta);
    }

    return NextResponse.json({
      totalTrades,
      totalMarkets,
      activeMarkets,
      settledMarkets,
      uniqueTraders,
      totalVolume: totalVolume.toString(),
      lastIndexedBlock: indexerState?.lastBlock?.toString() || "0",
      lastIndexedAt: indexerState?.updatedAt,
      stats24h: {
        volume: volume24h.toString(),
        trades: recentTrades.length,
        buys: buys24h,
        sells: sells24h,
      },
    });
  } catch (e) {
    console.error("Stats API error:", e);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
