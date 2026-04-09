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
      <div className="page-shell mx-auto max-w-7xl px-4 py-8">
        <section className="page-hero animate-pulse">
          <div className="h-6 w-40 rounded-full bg-white/10" />
          <div className="mt-6 h-12 w-2/3 rounded-2xl bg-white/10" />
          <div className="mt-4 h-6 w-1/2 rounded-xl bg-white/5" />
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-28 rounded-[1.15rem] bg-white/5" />
            ))}
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-28 rounded-[1.15rem] bg-white/5" />
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="page-shell mx-auto max-w-7xl px-4 py-8">
        <div className="section-panel glass-empty-state p-12 text-center">
          <p className="text-lg text-red-400">{error || "Address not found"}</p>
          <Link href="/" className="glass-control-button glass-control-button-secondary mt-5 inline-flex">
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
    <div className="page-shell mx-auto max-w-7xl px-4 py-8 space-y-8">
      <section className="page-hero">
        <span className="page-eyebrow">Wallet Intelligence</span>

        <div className="page-hero-header mt-5">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-all font-mono text-2xl font-bold tracking-[-0.04em] text-white sm:text-3xl">
                {stats.address}
              </h1>
              {stats.rank !== null && (
                <span className="glass-inline-meta">
                  Rank #{stats.rank.toLocaleString()} of {stats.totalTraders.toLocaleString()}
                </span>
              )}
            </div>

            <p className="page-description mt-4">
              A live profile of realized performance, market flow, and recent Delphi trades for
              this wallet. Rankings and P&amp;L refresh from indexed activity so this page stays in
              sync with the current archive.
            </p>
          </div>

          <a
            href={LINKS.address(stats.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-control-button glass-control-button-secondary"
          >
            View on Explorer
          </a>
        </div>

        <div className="glass-kpi-band mt-6">
          <div className="glass-kpi-band-card">
            <p className="page-stat-label">Trading Since</p>
            <p className="mt-3 text-xl font-semibold text-white">
              {stats.firstTrade ? formatDate(stats.firstTrade) : "N/A"}
            </p>
            <p className="mt-2 text-sm text-zinc-400">Wallet&apos;s first indexed Delphi trade</p>
          </div>

          <div className="glass-kpi-band-card">
            <p className="page-stat-label">Last Seen</p>
            <p className="mt-3 text-xl font-semibold text-white">
              {stats.lastTrade ? formatTimeAgo(stats.lastTrade) : "N/A"}
            </p>
            <p className="mt-2 text-sm text-zinc-400">Latest indexed on-chain activity</p>
          </div>

          <div className="glass-kpi-band-card">
            <p className="page-stat-label">Market Reach</p>
            <p className="mt-3 text-xl font-semibold text-white">{stats.marketsTraded}</p>
            <p className="mt-2 text-sm text-zinc-400">Distinct Delphi markets traded</p>
          </div>
        </div>

        <div className="page-stat-grid">
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
      </section>

      {stats.pnlChart.length > 1 && (
        <section className="section-panel">
          <div className="section-panel-header">
            <div className="section-panel-copy">
              <h2 className="text-xl font-semibold text-white">P&amp;L Curve</h2>
              <p>Server-calculated realized performance across this wallet&apos;s indexed trade history.</p>
            </div>
          </div>

          <div className="glass-table-shell p-4">
            <ResponsiveContainer width="100%" height={320}>
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
        </section>
      )}

      <section className="section-panel">
        <div className="section-panel-header">
          <div className="section-panel-copy">
            <h2 className="text-xl font-semibold text-white">Flow Split</h2>
            <p>Buy and sell volume distribution across the wallet&apos;s indexed Delphi activity.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="card rounded-[1.25rem] border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018)),rgba(9,13,20,0.68)] p-5">
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="text-sm text-zinc-400">Buy Volume</span>
              <span className="font-mono text-emerald-400">{formatTokens(stats.buyVolume)}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800/80">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${buyVolumeShare}%` }}
              />
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-zinc-500">
              {buyVolumeShare.toFixed(2)}% of total flow
            </p>
          </div>

          <div className="card rounded-[1.25rem] border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018)),rgba(9,13,20,0.68)] p-5">
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="text-sm text-zinc-400">Sell Volume</span>
              <span className="font-mono text-red-400">{formatTokens(stats.sellVolume)}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800/80">
              <div
                className="h-full rounded-full bg-red-500"
                style={{ width: `${sellVolumeShare}%` }}
              />
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-zinc-500">
              {sellVolumeShare.toFixed(2)}% of total flow
            </p>
          </div>
        </div>
      </section>

      <section className="section-panel overflow-hidden">
        <div className="section-panel-header">
          <div className="section-panel-copy">
            <h2 className="text-xl font-semibold text-white">Trade History</h2>
            <p>The latest 50 indexed trades associated with this wallet.</p>
          </div>
        </div>

        <div className="glass-table-shell">
          {trades.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
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
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] ${
                            trade.isBuy
                              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                              : "border-red-500/25 bg-red-500/10 text-red-400"
                          }`}
                        >
                          {trade.isBuy ? "BUY" : "SELL"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/markets/${trade.marketId}`}
                          className="block max-w-[220px] truncate text-sm text-zinc-300 transition-colors hover:text-blue-400"
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
            <div className="glass-empty-state p-8 text-center text-zinc-500">No trades found</div>
          )}
        </div>
      </section>
    </div>
  );
}
