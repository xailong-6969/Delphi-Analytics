"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import { formatTokens, formatAddress, formatTimeAgo, formatDate } from "@/lib/utils";
import { LINKS } from "@/lib/constants";
import { MARKETS } from "@/lib/markets-config";
import StatCard from "@/components/ui/StatCard";

interface AddressStats {
  address: string;
  totalTrades: number;
  totalVolume: string;
  buyVolume: string;
  sellVolume: string;
  buyCount: number;
  sellCount: number;
  marketsTraded: number;
  openPositions: number;
  realizedPnl: string;
  totalCostBasis: string;
  unrealizedCostBasis: string;
  firstTrade: string | null;
  lastTrade: string | null;
}

interface Trade {
  id: string;
  txHash: string;
  blockTime: string;
  marketId: string;
  marketTitle: string | null;
  modelIdx: string;
  isBuy: boolean;
  tokensDelta: string;
  sharesDelta: string;
  impliedProbability: number;
}

interface PnlDataPoint {
  time: string;
  displayTime: string;
  pnl: number;
  cumulativePnl: number;
  volume: number;
}

interface RankData {
  rank: number;
  totalTraders: number;
}

export default function AddressPage() {
  const { address } = useParams();
  const [stats, setStats] = useState<AddressStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [rankData, setRankData] = useState<RankData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch stats and trades
        const [statsRes, tradesRes, allTradesRes] = await Promise.all([
          fetch(`/api/address/${address}/stats`),
          fetch(`/api/address/${address}/trades?take=50`),
          fetch(`/api/address/${address}/trades?take=500`),
        ]);

        if (!statsRes.ok) throw new Error("Invalid address or no trades found");

        const [statsData, tradesData, allTradesData] = await Promise.all([
          statsRes.json(),
          tradesRes.json(),
          allTradesRes.json(),
        ]);

        setStats(statsData);
        setTrades(tradesData.trades || []);
        setAllTrades(allTradesData.trades || []);

        // Fetch rank separately (don't fail if it errors)
        try {
          const rankRes = await fetch(`/api/leaderboard?search=${address}`);
          if (rankRes.ok) {
            const rankJson = await rankRes.json();
            if (rankJson.leaderboard && rankJson.leaderboard.length > 0) {
              const trader = rankJson.leaderboard.find(
                (t: any) => t.address.toLowerCase() === (address as string).toLowerCase()
              );
              if (trader) {
                setRankData({
                  rank: trader.rank,
                  totalTraders: rankJson.totalTraders || 0,
                });
              }
            }
          }
        } catch (e) {
          console.log("Could not fetch rank:", e);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    if (address) fetchData();
  }, [address]);

  // Calculate P&L over time for chart
  const pnlChartData = useMemo(() => {
    if (!allTrades || allTrades.length === 0) return [];

    const sortedTrades = [...allTrades].sort(
      (a, b) => new Date(a.blockTime).getTime() - new Date(b.blockTime).getTime()
    );

    const positions = new Map<string, { shares: number; cost: number }>();
    let cumulativePnl = 0;
    const dataPoints: PnlDataPoint[] = [];

    for (const trade of sortedTrades) {
      const tokens = Math.abs(parseFloat(trade.tokensDelta)) / 1e18;
      const shares = Math.abs(parseFloat(trade.sharesDelta)) / 1e18;
      const posKey = `${trade.marketId}:${trade.modelIdx}`;

      let tradePnl = 0;

      if (trade.isBuy) {
        const pos = positions.get(posKey) || { shares: 0, cost: 0 };
        pos.shares += shares;
        pos.cost += tokens;
        positions.set(posKey, pos);
      } else {
        const pos = positions.get(posKey);
        if (pos && pos.shares > 0) {
          const avgCost = pos.cost / pos.shares;
          const costBasis = avgCost * shares;
          tradePnl = tokens - costBasis;
          pos.shares -= shares;
          pos.cost -= costBasis;
          if (pos.shares < 0) pos.shares = 0;
          if (pos.cost < 0) pos.cost = 0;
          positions.set(posKey, pos);
        } else {
          tradePnl = tokens;
        }
      }

      cumulativePnl += tradePnl;

      dataPoints.push({
        time: trade.blockTime,
        displayTime: new Date(trade.blockTime).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        pnl: tradePnl,
        cumulativePnl: cumulativePnl,
        volume: tokens,
      });
    }

    const dailyData = new Map<string, PnlDataPoint>();
    for (const point of dataPoints) {
      const day = point.displayTime;
      if (dailyData.has(day)) {
        const existing = dailyData.get(day)!;
        existing.pnl += point.pnl;
        existing.volume += point.volume;
        existing.cumulativePnl = point.cumulativePnl;
      } else {
        dailyData.set(day, { ...point });
      }
    }

    return Array.from(dailyData.values());
  }, [allTrades]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-800 rounded w-1/2"></div>
          <div className="grid grid-cols-4 gap-4 mt-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-zinc-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="card p-12 text-center">
          <p className="text-red-400 text-lg">{error || "Address not found"}</p>
          <Link href="/" className="mt-4 inline-block text-blue-400 hover:underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const pnl = BigInt(stats.realizedPnl);
  const isProfitable = pnl > 0n;
  const isLoss = pnl < 0n;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-xl sm:text-2xl font-bold text-white font-mono break-all">
            {stats.address}
          </h1>
          {rankData && (
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium">
              🏆 #{rankData.rank.toLocaleString()} of {rankData.totalTraders.toLocaleString()}
            </span>
          )}
          <a
            href={LINKS.address(stats.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-sm text-zinc-500 hover:text-zinc-300"
          >
            View on Explorer ↗
          </a>
        </div>
        <p className="text-zinc-500 text-sm">
          Trading since {stats.firstTrade ? formatDate(stats.firstTrade) : "N/A"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Realized P&L"
          value={(isProfitable ? "+" : "") + formatTokens(stats.realizedPnl)}
          color={isProfitable ? "green" : isLoss ? "red" : "blue"}
          subtitle="$TEST"
        />
        <StatCard
          title="Total Volume"
          value={formatTokens(stats.totalVolume)}
          subtitle="$TEST"
          color="cyan"
        />
        <StatCard
          title="Total Trades"
          value={stats.totalTrades}
          subtitle={`${stats.buyCount} buys, ${stats.sellCount} sells`}
          color="blue"
        />
        <StatCard
          title="Open Positions"
          value={stats.openPositions}
          subtitle={`${stats.marketsTraded} markets traded`}
          color="purple"
        />
      </div>

      {/* P&L Chart */}
      {pnlChartData.length > 1 && (
        <div className="card p-5 mb-8">
          <h2 className="font-semibold text-white mb-4">📈 P&L Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={pnlChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={isProfitable ? "#10b981" : "#ef4444"}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={isProfitable ? "#10b981" : "#ef4444"}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
              <XAxis
                dataKey="displayTime"
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 11 }}
              />
              <YAxis
                stroke="#52525b"
                tick={{ fill: "#71717a", fontSize: 11 }}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(0))}
              />
              <Tooltip
                contentStyle={{
                  background: "#16161f",
                  border: "1px solid #2a2a3a",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [
                  `${value >= 0 ? "+" : ""}${value.toFixed(2)} TEST`,
                  "Cumulative P&L",
                ]}
              />
              <ReferenceLine y={0} stroke="#52525b" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="cumulativePnl"
                stroke={isProfitable ? "#10b981" : "#ef4444"}
                strokeWidth={2}
                fill="url(#pnlGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Volume breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-zinc-500">Buy Volume</span>
            <span className="font-mono text-emerald-400">{formatTokens(stats.buyVolume)}</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{
                width: `${
                  (Number(BigInt(stats.buyVolume)) / (Number(BigInt(stats.totalVolume)) || 1)) * 100
                }%`,
              }}
            />
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-zinc-500">Sell Volume</span>
            <span className="font-mono text-red-400">{formatTokens(stats.sellVolume)}</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full"
              style={{
                width: `${
                  (Number(BigInt(stats.sellVolume)) / (Number(BigInt(stats.totalVolume)) || 1)) * 100
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Trade History */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--border-color)]">
          <h2 className="font-semibold text-white">Trade History</h2>
        </div>
        {trades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-[var(--border-color)]">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Market</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="table-row border-b border-[var(--border-color)] last:border-0"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          trade.isBuy
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {trade.isBuy ? "BUY" : "SELL"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/markets/${trade.marketId}`}
                        className="text-sm text-zinc-300 hover:text-blue-400 transition-colors truncate max-w-[180px] block"
                      >
                        {trade.marketTitle || `Market #${MARKETS[trade.marketId]?.displayId || trade.marketId}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-400">Model {trade.modelIdx}</span>
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
                      <a
                        href={LINKS.tx(trade.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        {formatTimeAgo(trade.blockTime)}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-500">No trades found</div>
        )}
      </div>
    </div>
  );
}
