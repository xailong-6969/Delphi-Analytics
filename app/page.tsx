import Link from "next/link";
import prisma from "@/lib/prisma";
import { formatNumber, formatTokens, formatAddress, formatTimeAgo } from "@/lib/utils";
import StatCard from "@/components/ui/StatCard";

export const dynamic = "force-dynamic";

async function getHomeData() {
  try {
    const [
      totalTrades,
      totalMarkets,
      activeMarkets,
      settledMarkets,
      indexerState,
      recentTrades,
    ] = await Promise.all([
      prisma.trade.count(),
      prisma.market.count(),
      prisma.market.count({ where: { status: 0 } }),
      prisma.market.count({ where: { status: 2 } }),
      prisma.indexerState.findUnique({ where: { id: "delphi" } }),
      prisma.trade.findMany({
        take: 10,
        orderBy: { blockTime: "desc" },
        select: {
          id: true,
          trader: true,
          isBuy: true,
          tokensDelta: true,
          blockTime: true,
          marketId: true,
          modelIdx: true,
          impliedProbability: true,
          market: {
            select: { title: true },
          },
        },
      }),
    ]);

    // Calculate total volume
    const allTrades = await prisma.trade.findMany({
      select: { tokensDelta: true },
    });
    let totalVolume = 0n;
    for (const t of allTrades) {
      totalVolume += BigInt(t.tokensDelta);
    }

    // 24h stats
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const trades24h = await prisma.trade.findMany({
      where: { blockTime: { gte: oneDayAgo } },
      select: { tokensDelta: true },
    });
    let volume24h = 0n;
    for (const t of trades24h) {
      volume24h += BigInt(t.tokensDelta);
    }

    // Get unique traders
    const uniqueTraders = await prisma.trade.findMany({
      distinct: ["trader"],
      select: { trader: true },
    });

    return {
      totalTrades,
      totalMarkets,
      activeMarkets,
      settledMarkets,
      totalVolume: totalVolume.toString(),
      volume24h: volume24h.toString(),
      trades24h: trades24h.length,
      uniqueTraders: uniqueTraders.length,
      lastIndexedBlock: indexerState?.lastBlock?.toString() || "0",
      recentTrades,
    };
  } catch (e) {
    console.error("Home data fetch error:", e);
    return {
      totalTrades: 0,
      totalMarkets: 0,
      activeMarkets: 0,
      settledMarkets: 0,
      totalVolume: "0",
      volume24h: "0",
      trades24h: 0,
      uniqueTraders: 0,
      lastIndexedBlock: "0",
      recentTrades: [],
    };
  }
}

export default async function HomePage() {
  const data = await getHomeData();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          <span className="gradient-text">Delphi Analytics</span>
        </h1>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
          Track prediction markets, analyze trading patterns, and monitor P&L 
          for Delphi on Gensyn Testnet.
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Volume"
          value={formatNumber(Number(data.totalVolume) / 1e18)}
          subtitle="$TEST all-time"
          color="cyan"
        />
        <StatCard
          title="24h Volume"
          value={formatNumber(Number(data.volume24h) / 1e18)}
          subtitle={`${data.trades24h} trades`}
          color="green"
        />
        <StatCard
          title="Active Markets"
          value={data.activeMarkets}
          subtitle={`${data.settledMarkets} settled`}
          color="blue"
        />
        <StatCard
          title="Unique Traders"
          value={formatNumber(data.uniqueTraders, 0)}
          subtitle={`${formatNumber(data.totalTrades, 0)} total trades`}
          color="purple"
        />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Link href="/markets" className="card p-6 card-hover group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-2xl">
              📊
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                Markets
              </h3>
              <p className="text-sm text-zinc-500">View all prediction markets</p>
            </div>
          </div>
        </Link>

        <Link href="/leaderboard" className="card p-6 card-hover group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-2xl">
              🏆
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                Leaderboard
              </h3>
              <p className="text-sm text-zinc-500">Top traders by P&L</p>
            </div>
          </div>
        </Link>

        <a 
          href="https://delphi.gensyn.ai" 
          target="_blank" 
          rel="noopener noreferrer"
          className="card p-6 card-hover group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-2xl">
              🎯
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors">
                Trade Now
              </h3>
              <p className="text-sm text-zinc-500">Buy shares on Delphi</p>
            </div>
          </div>
        </a>
      </div>

      {/* Recent Trades */}
      {data.recentTrades.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
            <h2 className="font-semibold text-white">Recent Trades</h2>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-live"></span>
              <span>Live</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-[var(--border-color)]">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Trader</th>
                  <th className="px-4 py-3 font-medium">Market</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTrades.map((trade: any) => (
                  <tr key={trade.id} className="table-row border-b border-[var(--border-color)] last:border-0">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        trade.isBuy 
                          ? "bg-emerald-500/10 text-emerald-400" 
                          : "bg-red-500/10 text-red-400"
                      }`}>
                        {trade.isBuy ? "BUY" : "SELL"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link 
                        href={`/address/${trade.trader}`}
                        className="font-mono text-sm text-zinc-300 hover:text-blue-400 transition-colors"
                      >
                        {formatAddress(trade.trader, 4)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link 
                        href={`/markets/${trade.marketId}`}
                        className="text-sm text-zinc-300 hover:text-blue-400 transition-colors truncate max-w-[200px] block"
                      >
                        {trade.market?.title || `Market #${trade.marketId}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-sm text-white">
                        {formatTokens(trade.tokensDelta)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-sm text-zinc-400">
                        {trade.impliedProbability?.toFixed(1) || "0"}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs text-zinc-500">
                        {formatTimeAgo(trade.blockTime)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Indexer Status */}
      <div className="mt-6 text-center">
        <p className="text-xs text-zinc-600">
          Last indexed block: <span className="font-mono text-zinc-500">{data.lastIndexedBlock}</span>
        </p>
      </div>
    </div>
  );
}
