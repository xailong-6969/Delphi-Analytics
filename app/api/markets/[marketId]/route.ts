import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const { marketId: marketIdStr } = await params;
  
  try {
    const marketId = BigInt(marketIdStr);

    const [market, recentTrades, priceHistory] = await Promise.all([
      prisma.market.findUnique({
        where: { marketId },
        include: {
          _count: { select: { trades: true } },
        },
      }),
      prisma.trade.findMany({
        where: { marketId },
        orderBy: { blockTime: "desc" },
        take: 50,
        select: {
          id: true,
          txHash: true,
          trader: true,
          isBuy: true,
          modelIdx: true,
          tokensDelta: true,
          sharesDelta: true,
          modelNewPrice: true,
          impliedProbability: true,
          blockTime: true,
        },
      }),
      // Get price snapshots for charts
      prisma.priceSnapshot.findMany({
        where: { marketId },
        orderBy: { timestamp: "asc" },
        select: {
          modelIdx: true,
          probability: true,
          timestamp: true,
        },
      }),
    ]);

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Also get latest price per model from most recent trades
    const latestPrices = await prisma.trade.findMany({
      where: { marketId },
      orderBy: { blockTime: "desc" },
      distinct: ["modelIdx"],
      select: {
        modelIdx: true,
        modelNewPrice: true,
        impliedProbability: true,
      },
    });

    // Format price history for charts
    const pricesByModel = new Map<string, Array<{ time: string; probability: number }>>();
    for (const snap of priceHistory) {
      const key = snap.modelIdx.toString();
      if (!pricesByModel.has(key)) {
        pricesByModel.set(key, []);
      }
      pricesByModel.get(key)!.push({
        time: snap.timestamp.toISOString(),
        probability: snap.probability,
      });
    }

    return NextResponse.json({
      market: {
        marketId: market.marketId.toString(),
        title: market.title,
        description: market.description,
        category: market.category,
        configUri: market.configUri,
        status: market.status,
        statusLabel: market.status === 0 ? "Active" : market.status === 2 ? "Settled" : "Unknown",
        winningModelIdx: market.winningModelIdx?.toString(),
        createdAt: market.createdAtTime,
        endTime: market.endTime,
        settledAt: market.settledAt,
        totalTrades: market._count.trades,
        totalVolume: market.totalVolume,
        modelsJson: market.modelsJson,
      },
      latestPrices: latestPrices.map((p) => ({
        modelIdx: p.modelIdx.toString(),
        price: p.modelNewPrice,
        probability: p.impliedProbability,
      })),
      priceHistory: Object.fromEntries(pricesByModel),
      recentTrades: recentTrades.map((t) => ({
        ...t,
        modelIdx: t.modelIdx.toString(),
      })),
    });
  } catch (e) {
    console.error("Market API error:", e);
    return NextResponse.json({ error: "Failed to fetch market" }, { status: 500 });
  }
}
