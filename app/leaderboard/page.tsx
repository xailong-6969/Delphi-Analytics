import Link from "next/link";
import prisma from "@/lib/prisma";
import { formatNumber, formatTokens, formatAddress } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getLeaderboard() {
  try {
    // Try to get from precomputed stats first
    const precomputed = await prisma.traderStats.findMany({
      orderBy: { totalVolume: "desc" },
      take: 50,
    });

    if (precomputed.length > 0) {
      return precomputed.map((t, i) => ({
        rank: i + 1,
        address: t.address,
        totalTrades: t.totalTrades,
        totalVolume: t.totalVolume,
        buyCount: t.buyCount,
        sellCount: t.sellCount,
        realizedPnl: t.realizedPnl,
      }));
    }

    // Fallback: calculate on the fly
    const trades = await prisma.trade.findMany({
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

    const traderMap = new Map<string, {
      trades: number;
      volume: bigint;
      buys: number;
      sells: number;
      positions: Map<string, { shares: bigint; cost: bigint }>;
      realizedPnl: bigint;
    }>();

    for (const trade of trades) {
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

    return Array.from(traderMap.entries())
      .map(([address, stats]) => ({
        address,
        totalTrades: stats.trades,
        totalVolume: stats.volume.toString(),
        buyCount: stats.buys,
        sellCount: stats.sells,
        realizedPnl: stats.realizedPnl.toString(),
      }))
      .sort((a, b) => (BigInt(b.totalVolume) > BigInt(a.totalVolume) ? 1 : -1))
      .slice(0, 50)
      .map((t, i) => ({ ...t, rank: i + 1 }));
  } catch (e) {
    console.error("Leaderboard error:", e);
    return [];
  }
}

export default async function LeaderboardPage() {
  const traders = await getLeaderboard();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">🏆 Leaderboard</h1>
        <p className="text-zinc-400">Top traders ranked by total trading volume</p>
      </div>

      {traders.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-zinc-400 text-lg">No trading data yet. The indexer may still be syncing.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Trader</th>
                  <th className="px-4 py-3 font-medium text-right">Volume ($TEST)</th>
                  <th className="px-4 py-3 font-medium text-right">Realized P&L</th>
                  <th className="px-4 py-3 font-medium text-right">Trades</th>
                  <th className="px-4 py-3 font-medium text-right">Buy/Sell</th>
                </tr>
              </thead>
              <tbody>
                {traders.map((trader: any) => {
                  const pnl = BigInt(trader.realizedPnl);
                  const isProfitable = pnl > 0n;
                  const isLoss = pnl < 0n;

                  return (
                    <tr 
                      key={trader.address} 
                      className="table-row border-b border-[var(--border-color)] last:border-0"
                    >
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${
                          trader.rank === 1 ? "bg-amber-500 text-black" :
                          trader.rank === 2 ? "bg-zinc-400 text-black" :
                          trader.rank === 3 ? "bg-amber-700 text-white" :
                          "bg-zinc-800 text-zinc-400"
                        }`}>
                          {trader.rank}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Link 
                          href={`/address/${trader.address}`}
                          className="font-mono text-sm text-zinc-300 hover:text-blue-400 transition-colors"
                        >
                          {formatAddress(trader.address, 6)}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-mono text-sm font-medium text-white">
                          {formatTokens(trader.totalVolume)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-mono text-sm font-medium ${
                          isProfitable ? "text-emerald-400" :
                          isLoss ? "text-red-400" :
                          "text-zinc-400"
                        }`}>
                          {isProfitable && "+"}
                          {formatTokens(trader.realizedPnl)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm text-zinc-300">
                          {trader.totalTrades}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-emerald-400 text-sm">{trader.buyCount}</span>
                        <span className="text-zinc-600 mx-1">/</span>
                        <span className="text-red-400 text-sm">{trader.sellCount}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
