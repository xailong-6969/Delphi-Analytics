"use client";

import { useEffect, useState } from "react";
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
import { formatTokens, formatTimeAgo, formatDate } from "@/lib/utils";
import { LINKS } from "@/lib/constants";
import StatCard from "@/components/ui/StatCard";

interface PnlDataPoint {
  time: string;
  displayTime: string;
  pnl: number;
  cumulativePnl: number;
  volume: number;
}

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
  rank: number | null;
  totalTraders: number;
  pnlChart: PnlDataPoint[];
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

function calculateVolumeShare(part: string, total: string): number {
  const totalBigInt = BigInt(total);
  if (totalBigInt === 0n) {
    return 0;
  }

  return Number((BigInt(part) * 10000n) / totalBigInt) / 100;
}

export default function AddressPage() {
  const { address } = useParams();
  const [stats, setStats] = useState<AddressStats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, tradesRes] = await Promise.all([
          fetch(`/api/address/${address}/stats`),
          fetch(`/api/address/${address}/trades?take=50`),
        ]);

        if (!statsRes.ok) {
          throw new Error("Invalid address or no trades found");
        }

        const [statsData, tradesData] = await Promise.all([statsRes.json(), tradesRes.json()]);
        setStats(statsData);
        setTrades(tradesData.trades || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }

    if (address) {
      fetchData();
    }
  }, [address]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/2 rounded bg-zinc-800" />
          <div className="mt-8 grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-24 rounded-xl bg-zinc-800" />
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
          <p className="text-lg text-red-400">{error || "Address not found"}</p>
          <Link href="/" className="mt-4 inline-block text-blue-400 hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const pnl = BigInt(stats.realizedPnl);
  const isProfitable = pnl > 0n;
  const isLoss = pnl < 0n;
  const buyVolumeShare = calculateVolumeShare(stats.buyVolume, stats.totalVolume);
  const sellVolumeShare = calculateVolumeShare(stats.sellVolume, stats.totalVolume);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="break-all font-mono text-xl font-bold text-white sm:text-2xl">
            {stats.address}
          </h1>
          {stats.rank !== null && (
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-sm font-medium text-amber-400">
              Rank #{stats.rank.toLocaleString()} of {stats.totalTraders.toLocaleString()}
            </span>
          )}
          <a
            href={LINKS.address(stats.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-sm text-zinc-500 hover:text-zinc-300"
          >
            View on Explorer ->
          </a>
        </div>
        <p className="text-sm text-zinc-500">
          Trading since {stats.firstTrade ? formatDate(stats.firstTrade) : "N/A"}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Realized P&L"
          value={`${isProfitable ? "+" : ""}${formatTokens(stats.realizedPnl)}`}
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

      {stats.pnlChart.length > 1 && (
        <div className="card mb-8 p-5">
          <h2 className="mb-4 font-semibold text-white">P&L Over Time</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={stats.pnlChart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                tickFormatter={(value) =>
                  value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toFixed(0)
                }
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

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-zinc-500">Buy Volume</span>
            <span className="font-mono text-emerald-400">{formatTokens(stats.buyVolume)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${buyVolumeShare}%` }}
            />
          </div>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-zinc-500">Sell Volume</span>
            <span className="font-mono text-red-400">{formatTokens(stats.sellVolume)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-red-500"
              style={{ width: `${sellVolumeShare}%` }}
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border-color)] p-4">
          <h2 className="font-semibold text-white">Trade History</h2>
        </div>
        {trades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-left text-xs text-zinc-500">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Market</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 text-right font-medium">Time</th>
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
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
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
                        className="block max-w-[180px] truncate text-sm text-zinc-300 transition-colors hover:text-blue-400"
                      >
                        {trade.marketTitle || `Market #${trade.marketId}`}
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
