"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatTokens, formatAddress, formatTimeAgo, formatDate } from "@/lib/utils";
import { LINKS } from "@/lib/constants";
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

        if (!statsRes.ok) throw new Error("Invalid address");

        const [statsData, tradesData] = await Promise.all([
          statsRes.json(),
          tradesRes.json(),
        ]);

        setStats(statsData);
        setTrades(tradesData.trades || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    if (address) fetchData();
  }, [address]);

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
                width: `${Number(BigInt(stats.buyVolume)) / (Number(BigInt(stats.totalVolume)) || 1) * 100}%` 
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
                width: `${Number(BigInt(stats.sellVolume)) / (Number(BigInt(stats.totalVolume)) || 1) * 100}%` 
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
                        href={`/markets/${trade.marketId}`}
                        className="text-sm text-zinc-300 hover:text-blue-400 transition-colors truncate max-w-[180px] block"
                      >
                        {trade.marketTitle || `Market #${trade.marketId}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-zinc-400">
                        Model {trade.modelIdx}
                      </span>
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
          <div className="p-8 text-center text-zinc-500">
            No trades found
          </div>
        )}
      </div>
    </div>
  );
}
