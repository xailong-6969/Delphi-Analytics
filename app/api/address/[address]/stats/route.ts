import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAddress } from "viem";
import { VALID_MARKET_IDS_BIGINT, MARKET_WINNERS } from "@/lib/markets-config";

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

    // Get all trades for this address - SAME MARKETS as leaderboard
    const trades = await prisma.trade.findMany({
      where: {
        trader: address,
        marketId: { in: VALID_MARKET_IDS_BIGINT }
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

    // Calculate stats - SAME LOGIC as leaderboard
    let totalVolume = 0n;
    let buyVolume = 0n;
    let sellVolume = 0n;
    let buyCount = 0;
    let sellCount = 0;
    let realizedPnl = 0n;

    const marketsTraded = new Set<string>();
    const modelsTraded = new Set<string>();
    const positions = new Map<string, { shares: bigint; cost: bigint }>();

    for (const trade of trades) {
      const tokens = BigInt(trade.tokensDelta);
      const shares = BigInt(trade.sharesDelta);
      const absTokens = tokens < 0n ? -tokens : tokens;
      const absShares = shares < 0n ? -shares : shares;

      totalVolume += absTokens;
      marketsTraded.add(trade.marketId.toString());
      modelsTraded.add(`${trade.marketId}:${trade.modelIdx}`);

      const posKey = `${trade.marketId}:${trade.modelIdx}`;
      let pos = positions.get(posKey) || { shares: 0n, cost: 0n };

      if (trade.isBuy) {
        buyCount++;
        buyVolume += absTokens;
        pos.shares += absShares;
        pos.cost += absTokens;
      } else {
        sellCount++;
        sellVolume += absTokens;
        if (pos.shares > 0n) {
          const avgCost = (pos.cost * BigInt(1e18)) / pos.shares;
          const costBasis = (avgCost * absShares) / BigInt(1e18);
          const pnl = absTokens - costBasis;
          realizedPnl += pnl;

          pos.shares -= absShares;
          pos.cost -= costBasis;
          if (pos.shares < 0n) pos.shares = 0n;
          if (pos.cost < 0n) pos.cost = 0n;
        } else {
          realizedPnl += absTokens;
        }
      }
      positions.set(posKey, pos);
    }

    // Add settlement P&L - SAME LOGIC as leaderboard
    let openPositions = 0;
    let unrealizedCostBasis = 0n;
    let totalCostBasis = 0n;

    for (const [posKey, pos] of positions.entries()) {
      totalCostBasis += pos.cost;

      if (pos.shares > 0n) {
        const [marketId, modelIdx] = posKey.split(":");
        const winnerIdx = MARKET_WINNERS[marketId];

        if (winnerIdx !== undefined) {
          // Market is settled
          if (Number(modelIdx) === winnerIdx) {
            realizedPnl += pos.shares - pos.cost;
          } else {
            realizedPnl -= pos.cost;
          }
        } else {
          // Market not settled - open position
          openPositions++;
          unrealizedCostBasis += pos.cost;
        }
      }
    }

    return NextResponse.json({
      address,
      totalTrades: trades.length,
      totalVolume: totalVolume.toString(),
      buyVolume: buyVolume.toString(),
      sellVolume: sellVolume.toString(),
      buyCount,
      sellCount,
      marketsTraded: marketsTraded.size,
      modelsTraded: modelsTraded.size,
      openPositions,
      realizedPnl: realizedPnl.toString(),
      totalCostBasis: totalCostBasis.toString(),
      unrealizedCostBasis: unrealizedCostBasis.toString(),
      firstTrade: trades[0]?.blockTime || null,
      lastTrade: trades[trades.length - 1]?.blockTime || null,
    });
  } catch (e) {
    console.error("Address stats error:", e);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
