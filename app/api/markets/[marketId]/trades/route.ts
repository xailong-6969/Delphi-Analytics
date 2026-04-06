import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { VALID_MARKET_IDS } from "@/lib/markets-config";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { marketId: string } }
) {
  const { marketId } = params;

  if (!VALID_MARKET_IDS.includes(marketId)) {
    return NextResponse.json({ error: "Invalid market ID" }, { status: 400 });
  }

  try {
    const trades = await prisma.trade.findMany({
      where: { marketId: BigInt(marketId) },
      orderBy: { blockTime: "desc" },
      take: 25,
      select: {
        id: true,
        trader: true,
        isBuy: true,
        tokensDelta: true,
        sharesDelta: true,
        modelIdx: true,
        blockTime: true,
        txHash: true,
        impliedProbability: true,
      },
    });

    // Serialize BigInts to strings
    const serialized = trades.map((t) => ({
      id: t.id,
      trader: t.trader,
      isBuy: t.isBuy,
      tokensDelta: t.tokensDelta.toString(),
      sharesDelta: t.sharesDelta.toString(),
      modelIdx: t.modelIdx.toString(),
      blockTime: t.blockTime.toISOString(),
      txHash: t.txHash,
      impliedProbability: t.impliedProbability,
    }));

    // Also get market stats
    const market = await prisma.market.findUnique({
      where: { marketId: BigInt(marketId) },
      include: { _count: { select: { trades: true } } },
    });

    return NextResponse.json({
      trades: serialized,
      totalTrades: market?._count.trades || 0,
      totalVolume: market?.totalVolume?.toString() || "0",
    });
  } catch (error) {
    console.error("Trades API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trades" },
      { status: 500 }
    );
  }
}
