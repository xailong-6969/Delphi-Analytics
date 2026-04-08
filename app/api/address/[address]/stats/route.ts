import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAddress } from "viem";
import { analyzeTraderTrades } from "@/lib/trader-analytics";
import { getTraderRankSnapshot } from "@/lib/leaderboard-data";
import { getSettledWinnerMap } from "@/lib/live-markets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isHexAddress(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: rawAddress } = await params;

  if (!rawAddress || !isHexAddress(rawAddress)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const address = getAddress(rawAddress);

    const trades = await prisma.trade.findMany({
      where: {
        trader: address,
      },
      orderBy: { blockTime: "asc" },
      select: {
        isBuy: true,
        tokensDelta: true,
        sharesDelta: true,
        marketId: true,
        modelIdx: true,
        blockTime: true,
      },
    });

    const settledWinnerMap = await getSettledWinnerMap(prisma);
    const summary = analyzeTraderTrades(trades, settledWinnerMap);
    const rankSnapshot = await getTraderRankSnapshot(address, "pnl");

    return NextResponse.json({
      address,
      totalTrades: trades.length,
      totalVolume: summary.totalVolume.toString(),
      buyVolume: summary.buyVolume.toString(),
      sellVolume: summary.sellVolume.toString(),
      buyCount: summary.buyCount,
      sellCount: summary.sellCount,
      marketsTraded: summary.marketsTraded,
      modelsTraded: summary.modelsTraded,
      openPositions: summary.openPositions,
      realizedPnl: summary.realizedPnl.toString(),
      totalCostBasis: summary.totalCostBasis.toString(),
      unrealizedCostBasis: summary.unrealizedCostBasis.toString(),
      firstTrade: summary.firstTrade,
      lastTrade: summary.lastTrade,
      rank: rankSnapshot?.rank ?? null,
      totalTraders: rankSnapshot?.totalTraders ?? 0,
      pnlChart: summary.chartData,
    });
  } catch (e) {
    console.error("Address stats error:", e);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
