import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sortBy = url.searchParams.get("sort") || "volume"; // volume, pnl, trades
  const take = Math.min(Number(url.searchParams.get("take") || 50), 100);
  const skip = Number(url.searchParams.get("skip") || 0);

  try {
    // Get all traders with precomputed stats
    let orderBy: any = { totalVolume: "desc" };
    if (sortBy === "pnl") orderBy = { realizedPnl: "desc" };
    else if (sortBy === "trades") orderBy = { totalTrades: "desc" };

    const [traders, total] = await Promise.all([
      prisma.traderStats.findMany({
        orderBy,
        take,
        skip,
      }),
      prisma.traderStats.count(),
    ]);

    // If no precomputed stats, calculate on the fly (slower but works)
    if (traders.length === 0) {
      const allTrades = await prisma.trade.findMany({
        select: {
          trader: true,
          isBuy: true,
          tokensDelta: true,
          sharesDelta: true,
          marketId: true,
          modelIdx: true,
        },
        orderBy: { blockTime: "asc" },
      });

      // Aggregate per trader
      const traderMap = new Map<string, {
        trades: number;
        volume: bigint;
        buys: number;
        sells: number;
        positions: Map<string, { shares: bigint; cost: bigint }>;
        realizedPnl: bigint;
      }>();

      for (const trade of allTrades) {
        let t = traderMap.get(trade.trader);
        if (!t) {
          t = { trades: 0, volume: 0n, buys: 0, sells: 0, positions: new Map(), realizedPnl: 0n };
          traderMap.set(trade.trader, t);
        }

        const tokens = BigInt(trade.tokensDelta);
        const shares = BigInt(trade.sharesDelta);
        t.trades++;
        t.volume += tokens;

        const posKey = `${trade.marketId}:${trade.modelIdx}`;
        let pos = t.positions.get(posKey) || { shares: 0n, cost: 0n };

        if (trade.isBuy) {
          t.buys++;
          pos.shares += shares;
          pos.cost += tokens;
        } else {
          t.sells++;
          if (pos.shares > 0n) {
            const avgCost = pos.cost / pos.shares;
            const costRemoved = avgCost * shares;
            t.realizedPnl += tokens - costRemoved;
            pos.shares -= shares;
            pos.cost = pos.cost > costRemoved ? pos.cost - costRemoved : 0n;
          } else {
            t.realizedPnl += tokens;
          }
        }
        t.positions.set(posKey, pos);
      }

      // Sort and format
      const sorted = Array.from(traderMap.entries())
        .map(([address, stats]) => ({
          address,
          totalTrades: stats.trades,
          totalVolume: stats.volume.toString(),
          buyCount: stats.buys,
          sellCount: stats.sells,
          realizedPnl: stats.realizedPnl.toString(),
        }))
        .sort((a, b) => {
          if (sortBy === "pnl") {
            return BigInt(b.realizedPnl) > BigInt(a.realizedPnl) ? 1 : -1;
          } else if (sortBy === "trades") {
            return b.totalTrades - a.totalTrades;
          }
          return BigInt(b.totalVolume) > BigInt(a.totalVolume) ? 1 : -1;
        })
        .slice(skip, skip + take);

      return NextResponse.json({
        traders: sorted,
        total: traderMap.size,
        take,
        skip,
        sortBy,
      });
    }

    return NextResponse.json({
      traders: traders.map((t) => ({
        address: t.address,
        totalTrades: t.totalTrades,
        totalVolume: t.totalVolume,
        buyCount: t.buyCount,
        sellCount: t.sellCount,
        realizedPnl: t.realizedPnl,
        firstTradeAt: t.firstTradeAt,
        lastTradeAt: t.lastTradeAt,
      })),
      total,
      take,
      skip,
      sortBy,
    });
  } catch (e) {
    console.error("Leaderboard API error:", e);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
