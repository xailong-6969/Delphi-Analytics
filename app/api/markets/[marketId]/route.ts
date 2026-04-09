import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getLiveMarketById, isNumericMarketId } from "@/lib/live-markets";
import { normalizeMarketId } from "@/lib/markets-config";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ marketId: string }> }
) {
  const { marketId: rawMarketId } = await params;
  const marketIdStr = normalizeMarketId(rawMarketId);
  
  try {
    if (!isNumericMarketId(marketIdStr)) {
      return NextResponse.json({ error: "Invalid market ID" }, { status: 400 });
    }

    const marketId = BigInt(marketIdStr);
    const marketSummary = await getLiveMarketById(prisma, marketIdStr);

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

    if (!market || !marketSummary) {
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
        marketId: marketSummary.internalId,
        title: marketSummary.title,
        description: marketSummary.description,
        category: marketSummary.category,
        configUri: marketSummary.configUri,
        status: marketSummary.status === "settled" ? 2 : 0,
        statusLabel: marketSummary.status === "settled" ? "Settled" : "Active",
        winningModelIdx: marketSummary.winnerIdx?.toString(),
        createdAt: marketSummary.createdAt,
        endTime: marketSummary.endTime,
        settledAt: marketSummary.settledAt,
        totalTrades: marketSummary.totalTrades || market._count.trades,
        totalVolume: marketSummary.totalVolume,
        modelsJson: marketSummary.models.map((model) => ({
          idx: model.idx,
          familyName: model.family,
          modelName: model.name,
        })),
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
