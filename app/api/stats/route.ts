import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // All from DATABASE - no external API calls!
    const [activeCount, settledCount, allTrades, indexerState] = await Promise.all([
      prisma.market.count({ where: { status: 0 } }),
      prisma.market.count({ where: { status: 2 } }),
      prisma.trade.findMany({
        select: {
          tokensDelta: true,
          blockTime: true,
          isBuy: true,
          trader: true,
        },
      }),
      prisma.indexerState.findUnique({ where: { id: "delphi" } }),
    ]);

    // Calculate stats
    let totalVolume = 0n;
    const uniqueTraders = new Set<string>();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let volume24h = 0n;
    let trades24h = 0;
    let buys24h = 0;
    let sells24h = 0;

    for (const t of allTrades) {
      const tokens = BigInt(t.tokensDelta);
      const absTokens = tokens < 0n ? -tokens : tokens;
      totalVolume += absTokens;
      uniqueTraders.add(t.trader);

      if (t.blockTime && t.blockTime >= oneDayAgo) {
        volume24h += absTokens;
        trades24h++;
        if (t.isBuy) buys24h++;
        else sells24h++;
      }
    }

    return NextResponse.json({
      totalTrades: allTrades.length,
      totalMarkets: activeCount + settledCount,
      activeMarkets: activeCount,
      settledMarkets: settledCount,
      uniqueTraders: uniqueTraders.size,
      totalVolume: totalVolume.toString(),
      totalVolumeFormatted: formatVolume(totalVolume),
      trades24h,
      volume24h: volume24h.toString(),
      volume24hFormatted: formatVolume(volume24h),
      buys24h,
      sells24h,
      lastIndexedBlock: indexerState?.lastBlock?.toString() || "0",
      lastIndexedAt: indexerState?.updatedAt?.toISOString(),
      isIndexerRunning: indexerState?.isRunning || false,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

function formatVolume(volume: bigint): string {
  const num = Number(volume) / 1e18;
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
  return num.toFixed(2);
}
